package com.example.backend.controller;

import com.example.backend.repository.UserRepository;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminUserController {

    private final UserRepository userRepository;

    @GetMapping
    public List<UserSummary> listUsers() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<User> users = (tenantId != null)
                ? userRepository.findByTenant_Id(tenantId)
                : userRepository.findAll();
        return users.stream().map(UserSummary::from).toList();
    }

    @PatchMapping("/{id}/role")
    public ResponseEntity<?> updateRole(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        String roleName = body.get("role");
        if (roleName == null) return ResponseEntity.badRequest().body(Map.of("message", "role is required"));
        Role role;
        try { role = Role.valueOf(roleName.toUpperCase()); }
        catch (IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("message", "Invalid role: " + roleName)); }

        UUID tenantId = TenantContext.getCurrentTenantId();
        User user = (tenantId != null ? userRepository.findByIdAndTenant_Id(id, tenantId) : userRepository.findById(id))
                .orElse(null);
        if (user == null) return ResponseEntity.notFound().build();
        user.setRole(role);
        userRepository.save(user);
        return ResponseEntity.ok(UserSummary.from(user));
    }

    @PatchMapping("/{id}/active")
    public ResponseEntity<?> setActive(@PathVariable UUID id, @RequestBody Map<String, Boolean> body) {
        Boolean active = body.get("active");
        if (active == null) return ResponseEntity.badRequest().body(Map.of("message", "active is required"));
        UUID tenantId = TenantContext.getCurrentTenantId();
        User user = (tenantId != null ? userRepository.findByIdAndTenant_Id(id, tenantId) : userRepository.findById(id))
                .orElse(null);
        if (user == null) return ResponseEntity.notFound().build();
        user.setActive(active);
        userRepository.save(user);
        return ResponseEntity.ok(UserSummary.from(user));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
        if (!userRepository.existsById(id)) return ResponseEntity.notFound().build();
        userRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    record UserSummary(UUID id, String email, String fullName, String phone,
                       String role, boolean active, String tenantId) {
        static UserSummary from(User u) {
            return new UserSummary(
                u.getId(), u.getEmail(), u.getFullName(), u.getPhone(),
                u.getRole() != null ? u.getRole().name() : null,
                u.isActive(),
                u.getTenant() != null ? u.getTenant().getId().toString() : null
            );
        }
    }
}
