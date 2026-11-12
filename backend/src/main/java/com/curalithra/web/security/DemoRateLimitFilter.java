package com.curalithra.web.security;

import com.curalithra.web.exception.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;

/**
 * Enforces server-side rate limiting on Public Demo login, reset, and demo mutation endpoints.
 * Registered directly inside Spring Security after {@link JwtAuthFilter}.
 */
public class DemoRateLimitFilter extends OncePerRequestFilter {

    private final RateLimitService rateLimitService;
    private final ObjectMapper objectMapper;

    public DemoRateLimitFilter(RateLimitService rateLimitService, ObjectMapper objectMapper) {
        this.rateLimitService = rateLimitService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        RateLimitService.BucketType bucketType = resolveBucketType(request);
        if (bucketType != null) {
            RateLimitService.RateLimitDecision decision = rateLimitService.tryConsume(bucketType, request);
            response.setHeader("X-RateLimit-Limit", String.valueOf(decision.limit()));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(decision.remaining()));

            if (!decision.allowed()) {
                response.setHeader("Retry-After", String.valueOf(decision.retryAfterSeconds()));
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                objectMapper.writeValue(response.getOutputStream(), new GlobalExceptionHandler.ApiError(
                        HttpStatus.TOO_MANY_REQUESTS.value(),
                        HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase(),
                        decision.message(),
                        Map.of(),
                        Instant.now()
                ));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private RateLimitService.BucketType resolveBucketType(HttpServletRequest request) {
        String method = request.getMethod();
        if (method == null || "OPTIONS".equalsIgnoreCase(method)
                || "GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method)) {
            return null;
        }

        String path = request.getRequestURI();
        String ctx = request.getContextPath();
        if (ctx != null && !ctx.isEmpty() && path.startsWith(ctx)) {
            path = path.substring(ctx.length());
        }

        if ("POST".equalsIgnoreCase(method) && "/api/auth/demo-login".equals(path)) {
            return RateLimitService.BucketType.DEMO_LOGIN;
        }
        if ("POST".equalsIgnoreCase(method) && "/api/demo/reset".equals(path)) {
            return RateLimitService.BucketType.DEMO_RESET;
        }
        if ("POST".equalsIgnoreCase(method) && "/api/auth/logout".equals(path)) {
            return null;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CuralithraUserPrincipal principal && principal.isDemoUser()) {
            return RateLimitService.BucketType.DEMO_MUTATION;
        }
        return null;
    }
}
