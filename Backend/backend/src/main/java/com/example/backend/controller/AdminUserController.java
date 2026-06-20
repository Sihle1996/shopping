package com.example.backend.controller;

import com.example.backend.auth.RegisterRequest;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.service.AdminDriverService;
import com.example.backend.service.AuditService;
import com.example.backend.service.EmailService;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Store TEAM management — the admins + drivers that belong to a store (tenant-scoped). Customers are
 * NOT here: they register without a tenant (marketplace-wide), so they never carry a store's id.
 *
 * Guardrails: every action is scoped to the caller's own store; you can never assign SUPERADMIN, act
 * on YOURSELF (delete / change-role / deactivate), or remove the store's LAST active admin.
 */
@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminUserController {

    private final UserRepository userRepository;
    private final AuditService auditService;
    private final AdminDriverService adminDriverService;
    private final PasswordEncoder passwordEncoder;
    private final TenantRepository tenantRepository;
    private final EmailService emailService;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    @GetMapping
    public List<UserSummary> listUsers() {
        return userRepository.findByTenant_Id(requireTenant()).stream().map(UserSummary::from).toList();
    }

    /** Invite a staff member to this store: a DRIVER (reuses the driver-onboarding flow) or a
     *  co-ADMIN. A temporary password is generated and the login details are emailed to them. */
    @PostMapping("/invite")
    public ResponseEntity<?> invite(@RequestBody Map<String, String> body) {
        UUID tenantId = requireTenant();
        String email = body.getOrDefault("email", "").trim().toLowerCase();
        String fullName = body.get("fullName");
        Role role;
        try { role = Role.valueOf(body.getOrDefault("role", "").toUpperCase()); }
        catch (IllegalArgumentException e) { return bad("Pick a role to invite."); }
        if (email.isEmpty() || !email.contains("@")) return bad("Enter a valid email address.");
        if (role != Role.DRIVER && role != Role.ADMIN) return forbidden("You can only invite a driver or a co-admin.");

        String tempPassword = generatePassword();

        if (role == Role.DRIVER) {
            // Reuse the existing driver onboarding (enforces the plan's driver limit + welcome email).
            try { adminDriverService.createDriver(new RegisterRequest(email, tempPassword)); }
            catch (Exception e) { return bad(e.getMessage() != null ? e.getMessage() : "Could not invite that driver."); }
            User created = userRepository.findByEmailAndTenant_Id(email, tenantId).orElse(null);
            return ok("Driver invited — login details emailed to " + email, created);
        }

        // Co-admin: the existing owner deliberately authorising another admin (public registration
        // can't mint a second admin, but an authenticated owner can).
        if (userRepository.findByEmailAndTenant_Id(email, tenantId).isPresent())
            return bad("That email is already on your team.");
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow();
        User admin = userRepository.save(User.builder()
                .email(email)
                .password(passwordEncoder.encode(tempPassword))
                .role(Role.ADMIN)
                .tenant(tenant)
                .fullName(fullName != null && !fullName.isBlank() ? fullName : null)
                .emailVerified(true)
                .active(true)
                .build());
        auditService.log(AuditService.ADMIN, "ADMIN_INVITED", "USER", admin.getId(), "Invited co-admin " + email);
        emailService.sendRaw(email, "You've been added as an admin on " + tenant.getName(),
                "<p>You've been added as an admin on <strong>" + tenant.getName() + "</strong>.</p>"
                        + "<p>Sign in at <a href=\"" + frontendUrl + "/login\">" + frontendUrl + "/login</a></p>"
                        + "<p>Email: <strong>" + email + "</strong><br>Temporary password: <strong>" + tempPassword + "</strong></p>"
                        + "<p>Please change your password after signing in.</p>");
        return ok("Co-admin invited — login details emailed to " + email, admin);
    }

    @PatchMapping("/{id}/role")
    public ResponseEntity<?> updateRole(@PathVariable UUID id, @RequestBody Map<String, String> body,
                                        @AuthenticationPrincipal User me) {
        UUID tenantId = requireTenant();
        String roleName = body.get("role");
        if (roleName == null) return bad("role is required");
        Role role;
        try { role = Role.valueOf(roleName.toUpperCase()); }
        catch (IllegalArgumentException e) { return bad("Invalid role: " + roleName); }
        // A store admin may only assign store-level roles — never SUPERADMIN (a one-request takeover).
        if (role != Role.USER && role != Role.DRIVER && role != Role.ADMIN) return forbidden("You cannot assign that role.");
        if (isSelf(id, me)) return bad("You can't change your own role.");

        User user = userRepository.findByIdAndTenant_Id(id, tenantId).orElse(null);
        if (user == null) return ResponseEntity.notFound().build();
        if (user.getRole() == Role.ADMIN && role != Role.ADMIN && isLastActiveAdmin(user, tenantId))
            return bad("Your store must keep at least one active admin.");
        user.setRole(role);
        userRepository.save(user);
        auditService.log(AuditService.ADMIN, "USER_ROLE_CHANGED", "USER", id, user.getEmail() + " → " + role.name());
        return ResponseEntity.ok(UserSummary.from(user));
    }

    @PatchMapping("/{id}/active")
    public ResponseEntity<?> setActive(@PathVariable UUID id, @RequestBody Map<String, Boolean> body,
                                       @AuthenticationPrincipal User me) {
        UUID tenantId = requireTenant();
        Boolean active = body.get("active");
        if (active == null) return bad("active is required");
        if (!active && isSelf(id, me)) return bad("You can't deactivate your own account.");

        User user = userRepository.findByIdAndTenant_Id(id, tenantId).orElse(null);
        if (user == null) return ResponseEntity.notFound().build();
        if (!active && user.getRole() == Role.ADMIN && isLastActiveAdmin(user, tenantId))
            return bad("Your store must keep at least one active admin.");
        user.setActive(active);
        userRepository.save(user);
        auditService.log(AuditService.ADMIN, "USER_ACTIVE_TOGGLED", "USER", id, user.getEmail() + (active ? " activated" : " deactivated"));
        return ResponseEntity.ok(UserSummary.from(user));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable UUID id, @AuthenticationPrincipal User me) {
        UUID tenantId = requireTenant();
        if (isSelf(id, me)) return bad("You can't delete your own account.");
        User user = userRepository.findByIdAndTenant_Id(id, tenantId).orElse(null);
        if (user == null) return ResponseEntity.notFound().build();
        if (user.getRole() == Role.ADMIN && isLastActiveAdmin(user, tenantId))
            return bad("Your store must keep at least one active admin.");
        String email = user.getEmail();
        userRepository.delete(user);
        auditService.log(AuditService.ADMIN, "USER_DELETED", "USER", id, "Removed " + email);
        return ResponseEntity.noContent().build();
    }

    // ── helpers ─────────────────────────────────────────────────────────────
    private UUID requireTenant() {
        UUID t = TenantContext.getCurrentTenantId();
        if (t == null) throw new SecurityException("Tenant context required");
        return t;
    }
    private boolean isSelf(UUID id, User me) { return me != null && id.equals(me.getId()); }
    /** True when no OTHER active admin would remain in the store after removing/demoting `target`. */
    private boolean isLastActiveAdmin(User target, UUID tenantId) {
        return userRepository.findByRoleAndTenant_Id(Role.ADMIN, tenantId).stream()
                .noneMatch(u -> u.isActive() && !u.getId().equals(target.getId()));
    }
    private String generatePassword() {
        final String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        SecureRandom r = new SecureRandom();
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) sb.append(chars.charAt(r.nextInt(chars.length())));
        return sb.toString();
    }
    private ResponseEntity<?> ok(String message, User u) {
        return ResponseEntity.ok(Map.of("message", message, "user", u != null ? UserSummary.from(u) : Map.of()));
    }
    private ResponseEntity<?> bad(String msg) { return ResponseEntity.badRequest().body(Map.of("message", msg)); }
    private ResponseEntity<?> forbidden(String msg) { return ResponseEntity.status(403).body(Map.of("message", msg)); }

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
