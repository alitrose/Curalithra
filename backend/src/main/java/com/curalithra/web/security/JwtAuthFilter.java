package com.curalithra.web.security;

import com.curalithra.web.entity.UserEntity;
import com.curalithra.web.repository.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final DemoTokenRevocationService demoTokenRevocationService;
    private final boolean demoEnabled;

    public JwtAuthFilter(JwtService jwtService,
                         UserRepository userRepository,
                         DemoTokenRevocationService demoTokenRevocationService,
                         @Value("${curalithra.demo.enabled:false}") boolean demoEnabled) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.demoTokenRevocationService = demoTokenRevocationService;
        this.demoEnabled = demoEnabled;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(7).trim();
        if (token.isEmpty()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            Claims claims = jwtService.parseClaims(token);
            String username = claims.getSubject();
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                Optional<UserEntity> found = userRepository.findByUsernameIgnoreCase(username);
                if (found.isPresent() && found.get().isActive()) {
                    UserEntity u = found.get();
                    Boolean tokenDemo = claims.get("demo", Boolean.class);
                    String tokenRole = claims.get("role", String.class);
                    String tokenScope = claims.get("scope", String.class);
                    Number tokenUid = claims.get("uid", Number.class);

                    String tokenJti = claims.getId();
                    Date tokenExpDate = claims.getExpiration();
                    Instant tokenExpiresAt = tokenExpDate != null ? tokenExpDate.toInstant() : null;

                    String expectedScope = u.isDemoUser() ? "DEMO_ONLY" : "STAFF";
                    boolean demoTokenActive = !u.isDemoUser()
                            || (demoEnabled
                            && tokenJti != null
                            && !tokenJti.isBlank()
                            && !demoTokenRevocationService.isRevoked(tokenJti));

                    boolean claimsValid = tokenDemo != null
                            && tokenDemo == u.isDemoUser()
                            && u.getRole().name().equals(tokenRole)
                            && expectedScope.equals(tokenScope)
                            && (tokenUid == null || tokenUid.longValue() == u.getId())
                            && demoTokenActive;

                    if (claimsValid) {
                        if (u.isDemoUser()) {
                            request.setAttribute("curalithra.demoMode", Boolean.TRUE);
                            request.setAttribute("curalithra.demoRole", u.getRole().name());
                            response.setHeader("X-Curalithra-Demo-Mode", "true");
                            response.setHeader("X-Curalithra-Demo-Role", u.getRole().name());
                        }
                        CuralithraUserPrincipal principal = new CuralithraUserPrincipal(
                                u.getId(), u.getUsername(), u.getFullName(), u.getEmail(),
                                u.getPasswordHash(), u.getRole(), u.getLinkedDoctorId(), u.isActive(), u.isDemoUser(),
                                tokenJti, tokenExpiresAt
                        );
                        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                                principal, null, principal.getAuthorities());
                        auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    }
                }
            }
        } catch (Exception ignored) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }
}
