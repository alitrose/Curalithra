package com.curalithra.web.security;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lightweight, memory-bounded server-side revocation store for demo JWT IDs ({@code jti}).
 * Compatible with single-instance Render Free deployments without external Redis infrastructure.
 */
@Service
public class DemoTokenRevocationService {

    private static final int MAX_TRACKED_TOKENS = 20_000;

    private final ConcurrentHashMap<String, Instant> revokedTokens = new ConcurrentHashMap<>();
    private final Clock clock;

    public DemoTokenRevocationService(Clock clock) {
        this.clock = clock;
    }

    public void revoke(String jti, Instant expiresAt) {
        if (jti == null || jti.isBlank()) {
            return;
        }
        Instant now = Instant.now(clock);
        Instant effectiveExpiry = expiresAt != null ? expiresAt : now.plusSeconds(1800);
        if (!effectiveExpiry.isAfter(now)) {
            return;
        }

        if (revokedTokens.size() >= MAX_TRACKED_TOKENS) {
            purgeExpired(now);
            if (revokedTokens.size() >= MAX_TRACKED_TOKENS) {
                evictExcessEntries();
            }
        }
        revokedTokens.put(jti, effectiveExpiry);
    }

    public boolean isRevoked(String jti) {
        if (jti == null || jti.isBlank()) {
            return false;
        }
        Instant expiry = revokedTokens.get(jti);
        if (expiry == null) {
            return false;
        }
        Instant now = Instant.now(clock);
        if (!expiry.isAfter(now)) {
            revokedTokens.remove(jti, expiry);
            return false;
        }
        return true;
    }

    public void clearForTests() {
        revokedTokens.clear();
    }

    private void purgeExpired(Instant now) {
        Iterator<Map.Entry<String, Instant>> it = revokedTokens.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Instant> entry = it.next();
            if (!entry.getValue().isAfter(now)) {
                it.remove();
            }
        }
    }

    private void evictExcessEntries() {
        int toRemove = Math.max(1, MAX_TRACKED_TOKENS / 10);
        Iterator<String> it = revokedTokens.keySet().iterator();
        while (it.hasNext() && toRemove > 0) {
            it.next();
            it.remove();
            toRemove--;
        }
    }
}
