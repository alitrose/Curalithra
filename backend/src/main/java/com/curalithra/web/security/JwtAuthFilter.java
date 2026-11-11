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
import java.util.Optional;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final boolean demoEnabled;

    public JwtAuthFilter(JwtService jwtService,
                         UserRepository userRepository,
                         @Value("${curalithra.demo.enabled:false}") boolean demoEnabled) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
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
                    if ((tokenDemo == null || tokenDemo == u.isDemoUser()) && (!u.isDemoUser() || demoEnabled)) {
                        CuralithraUserPrincipal principal = new CuralithraUserPrincipal(
                                u.getId(), u.getUsername(), u.getFullName(), u.getEmail(),
                                u.getPasswordHash(), u.getRole(), u.getLinkedDoctorId(), u.isActive(), u.isDemoUser()
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
