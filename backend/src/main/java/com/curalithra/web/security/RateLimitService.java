package com.curalithra.web.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lightweight, memory-bounded per-IP fixed-window rate limiter for Public Demo endpoints.
 * Requires zero external paid infrastructure (compatible with Render Free single-JVM hosting).
 */
@Service
public class RateLimitService {

    public enum BucketType {
        DEMO_LOGIN("demo-login", "Too many demo login attempts. Please wait a moment and try again."),
        DEMO_RESET("demo-reset", "Demo reset requests are throttled. Public demo resets are disabled."),
        DEMO_MUTATION("demo-mutation", "Too many write requests in Public Demo Mode. Please slow down.");

        private final String keyPrefix;
        private final String message;

        BucketType(String keyPrefix, String message) {
            this.keyPrefix = keyPrefix;
            this.message = message;
        }

        public String getKeyPrefix() { return keyPrefix; }
        public String getMessage() { return message; }
    }

    public record RateLimitDecision(
            boolean allowed,
            int limit,
            int remaining,
            long retryAfterSeconds,
            String message
    ) {}

    private static final int MAX_BUCKETS = 10_000;

    private static final class WindowState {
        private long windowStartMs;
        private int count;

        private WindowState(long windowStartMs, int count) {
            this.windowStartMs = windowStartMs;
            this.count = count;
        }
    }

    private final ConcurrentHashMap<String, WindowState> buckets = new ConcurrentHashMap<>();
    private final Clock clock;
    private final boolean enabled;
    private final long windowMs;
    private final int demoLoginMax;
    private final int demoResetMax;
    private final int demoMutationMax;

    public RateLimitService(
            Clock clock,
            @Value("${curalithra.rate-limit.enabled:true}") boolean enabled,
            @Value("${curalithra.rate-limit.window-seconds:60}") long windowSeconds,
            @Value("${curalithra.rate-limit.demo-login-max:20}") int demoLoginMax,
            @Value("${curalithra.rate-limit.demo-reset-max:5}") int demoResetMax,
            @Value("${curalithra.rate-limit.demo-mutation-max:15}") int demoMutationMax) {
        this.clock = clock;
        this.enabled = enabled;
        this.windowMs = Math.max(1000L, windowSeconds * 1000L);
        this.demoLoginMax = Math.max(1, demoLoginMax);
        this.demoResetMax = Math.max(1, demoResetMax);
        this.demoMutationMax = Math.max(1, demoMutationMax);
    }

    public RateLimitDecision tryConsume(BucketType type, HttpServletRequest request) {
        int limit = limitFor(type);
        if (!enabled) {
            return new RateLimitDecision(true, limit, limit, 0, type.getMessage());
        }

        long nowMs = clock.millis();
        if (buckets.size() >= MAX_BUCKETS) {
            pruneStaleBuckets(nowMs);
        }

        String clientKey = resolveClientKey(request);
        String key = type.getKeyPrefix() + ":" + clientKey;

        final boolean[] allowed = new boolean[1];
        final int[] remaining = new int[1];
        final long[] retryAfterSec = new long[1];

        buckets.compute(key, (k, existing) -> {
            if (existing == null || (nowMs - existing.windowStartMs) >= windowMs) {
                allowed[0] = true;
                remaining[0] = Math.max(0, limit - 1);
                retryAfterSec[0] = 0;
                return new WindowState(nowMs, 1);
            }
            if (existing.count < limit) {
                existing.count += 1;
                allowed[0] = true;
                remaining[0] = Math.max(0, limit - existing.count);
                retryAfterSec[0] = 0;
                return existing;
            }
            allowed[0] = false;
            remaining[0] = 0;
            long msLeft = Math.max(1000L, windowMs - (nowMs - existing.windowStartMs));
            retryAfterSec[0] = (msLeft + 999L) / 1000L;
            return existing;
        });

        return new RateLimitDecision(allowed[0], limit, remaining[0], retryAfterSec[0], type.getMessage());
    }

    public void resetAll() {
        buckets.clear();
    }

    private int limitFor(BucketType type) {
        return switch (type) {
            case DEMO_LOGIN -> demoLoginMax;
            case DEMO_RESET -> demoResetMax;
            case DEMO_MUTATION -> demoMutationMax;
        };
    }

    private String resolveClientKey(HttpServletRequest request) {
        String remote = request.getRemoteAddr();
        if (remote == null || remote.isBlank()) {
            return "unknown";
        }
        return remote.length() > 64 ? remote.substring(0, 64) : remote;
    }

    private void pruneStaleBuckets(long nowMs) {
        Iterator<Map.Entry<String, WindowState>> it = buckets.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, WindowState> entry = it.next();
            WindowState state = entry.getValue();
            synchronized (state) {
                if ((nowMs - state.windowStartMs) >= windowMs) {
                    it.remove();
                }
            }
        }
        if (buckets.size() >= MAX_BUCKETS) {
            int toDrop = Math.max(1, MAX_BUCKETS / 10);
            Iterator<String> keyIt = buckets.keySet().iterator();
            while (keyIt.hasNext() && toDrop > 0) {
                keyIt.next();
                keyIt.remove();
                toDrop--;
            }
        }
    }
}
