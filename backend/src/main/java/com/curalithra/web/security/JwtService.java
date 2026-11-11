package com.curalithra.web.security;

import com.curalithra.web.entity.UserEntity;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final SecretKey signingKey;
    private final long expirationMs;

    public JwtService(
            @Value("${curalithra.security.jwt-secret:}") String configuredSecret,
            @Value("${curalithra.security.jwt-expiration-ms:28800000}") long expirationMs,
            Environment env) {
        this.expirationMs = expirationMs;
        boolean isProd = env.acceptsProfiles(Profiles.of("prod"));
        String trimmed = configuredSecret == null ? "" : configuredSecret.trim();

        if (trimmed.isEmpty()) {
            if (isProd) {
                throw new IllegalStateException(
                        "CURALITHRA_JWT_SECRET must be configured with at least 32 characters in production.");
            }
            this.signingKey = Jwts.SIG.HS256.key().build();
            log.info("Using ephemeral runtime JWT signing key for non-production profile.");
        } else {
            byte[] keyBytes = trimmed.getBytes(StandardCharsets.UTF_8);
            if (keyBytes.length < 32) {
                throw new IllegalStateException(
                        "CURALITHRA_JWT_SECRET must be at least 32 bytes for HS256 signing.");
            }
            this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        }
    }

    public String generateToken(UserEntity user) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .subject(user.getUsername())
                .claim("uid", user.getId())
                .claim("role", user.getRole().name())
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long getExpirationMs() {
        return expirationMs;
    }
}
