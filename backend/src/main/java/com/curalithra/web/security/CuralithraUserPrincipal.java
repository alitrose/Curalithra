package com.curalithra.web.security;

import com.curalithra.web.enums.Role;
import com.curalithra.web.enums.RolePermission;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class CuralithraUserPrincipal implements UserDetails {

    private final Long id;
    private final String username;
    private final String fullName;
    private final String email;
    private final String passwordHash;
    private final Role role;
    private final Long linkedDoctorId;
    private final boolean active;
    private final boolean demoUser;
    private final List<GrantedAuthority> authorities;

    public CuralithraUserPrincipal(Long id, String username, String fullName, String email,
                                   String passwordHash, Role role, Long linkedDoctorId,
                                   boolean active, boolean demoUser) {
        this.id = id;
        this.username = username;
        this.fullName = fullName;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.linkedDoctorId = linkedDoctorId;
        this.active = active;
        this.demoUser = demoUser;

        List<GrantedAuthority> auths = new ArrayList<>();
        auths.add(new SimpleGrantedAuthority("ROLE_" + role.name()));
        for (RolePermission p : RolePermission.permissionsFor(role)) {
            auths.add(new SimpleGrantedAuthority("PERM_" + p.name()));
        }
        this.authorities = List.copyOf(auths);
    }

    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public Role getRole() { return role; }
    public Long getLinkedDoctorId() { return linkedDoctorId; }
    public boolean isActive() { return active; }
    public boolean isDemoUser() { return demoUser; }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }

    @Override
    public String getPassword() { return passwordHash; }

    @Override
    public String getUsername() { return username; }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return active; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return active; }
}
