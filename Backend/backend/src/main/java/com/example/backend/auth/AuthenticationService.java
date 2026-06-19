package com.example.backend.auth;

import com.example.backend.config.JwtService;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.service.EmailService;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import org.springframework.beans.factory.annotation.Value;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthenticationService {

    private final UserRepository repository;
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private static final int MAX_FAILED_LOGINS = 5;
    private static final long LOGIN_LOCK_MS = 15 * 60 * 1000L;
    // email(lowercased) -> [failCount, lockUntilEpochMillis]. Per-account brute-force lockout,
    // independent of client IP (so a spoofed X-Forwarded-For cannot dodge it).
    private final java.util.concurrent.ConcurrentHashMap<String, long[]> loginAttempts =
            new java.util.concurrent.ConcurrentHashMap<>();

    public AuthenticationResponse register(RegisterRequest request, UUID tenantId) {
        if (request.getPassword() == null || request.getPassword().length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
        // Check if the user already exists within this tenant (or globally if no tenant)
        if (tenantId != null) {
            repository.findByEmailAndTenant_Id(request.getEmail(), tenantId)
                    .ifPresent(user -> {
                        throw new IllegalArgumentException("User with email " + request.getEmail() + " already exists in this store");
                    });
        } else {
            repository.findByEmail(request.getEmail())
                    .ifPresent(user -> {
                        throw new IllegalArgumentException("User with email " + request.getEmail() + " already exists");
                    });
        }

        // Hash the password only once during registration
        String hashedPassword = passwordEncoder.encode(request.getPassword());

        // Resolve tenant if provided
        Tenant tenant = null;
        if (tenantId != null) {
            tenant = tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new IllegalArgumentException("Tenant not found with ID: " + tenantId));
            // Claim-once: a store gets its ADMIN only from the first owner to register during
            // onboarding. Once a store has an admin, public registration with its tenantId must NOT
            // mint another admin — otherwise anyone who knows a store's id could self-register as its
            // owner and take it over.
            if (repository.countByRoleAndTenant_Id(Role.ADMIN, tenant.getId()) > 0) {
                throw new IllegalArgumentException("This store already has an owner account.");
            }
        }

        // Create and save the user — ADMIN if registering with a tenant, USER otherwise
        Role assignedRole = (tenant != null) ? Role.ADMIN : Role.USER;

        // Every account — admin (store owner) or customer — must verify its email before it can
        // log in. Admins were previously auto-verified and auto-logged-in, which meant someone could
        // register a store with a fake/typo'd login email and be in immediately, with the real owner
        // never notified. The login email must now be proven before the account is usable.
        String verificationToken = UUID.randomUUID().toString();
        User user = User.builder()
                .email(request.getEmail())
                .password(hashedPassword)
                .role(assignedRole)
                .tenant(tenant)
                .emailVerified(false)
                .emailVerificationToken(verificationToken)
                .emailVerificationTokenExpiresAt(Instant.now().plusSeconds(86400))
                .build();
        user = repository.save(user);

        String verifyUrl = frontendUrl + "/verify-email?token=" + verificationToken;
        emailService.sendVerificationEmail(request.getEmail(), request.getEmail(), verifyUrl);

        return AuthenticationResponse.builder()
                .message("Check your email to verify your account before logging in.")
                .build();
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        String lockKey = request.getEmail() == null ? "" : request.getEmail().trim().toLowerCase();
        long now = System.currentTimeMillis();
        long[] state = loginAttempts.get(lockKey);
        if (state != null && state[1] > now) {
            // Account temporarily locked after too many failed attempts (brute-force defence).
            throw new IllegalArgumentException("Too many failed attempts. Please try again later.");
        }
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getEmail(),
                            request.getPassword()
                    )
            );
        } catch (org.springframework.security.core.AuthenticationException ex) {
            recordFailedLogin(lockKey, now);
            throw ex;
        }
        loginAttempts.remove(lockKey); // a successful login clears the counter

        UUID tenantId = TenantContext.getCurrentTenantId();
        User user = (tenantId != null)
                ? repository.findByEmailAndTenant_Id(request.getEmail(), tenantId)
                        .or(() -> repository.findByEmailAndTenantIsNull(request.getEmail()))
                        .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"))
                : repository.findByEmail(request.getEmail())
                        .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        UUID userTenantId = user.getTenant() != null ? user.getTenant().getId() : null;
        String jwtToken = jwtService.generateTokenWithId(user, user.getId(), userTenantId);

        String approvalStatus = (user.getTenant() != null && user.getTenant().getApprovalStatus() != null)
                ? user.getTenant().getApprovalStatus().name()
                : null;

        return AuthenticationResponse.builder()
                .token(jwtToken)
                .approvalStatus(approvalStatus)
                .build();
    }

    private void recordFailedLogin(String key, long now) {
        loginAttempts.compute(key, (k, v) -> {
            long count = (v == null ? 0 : v[0]) + 1;
            // Lock for the cooldown once the threshold is hit; reset the count for after the lock.
            return count >= MAX_FAILED_LOGINS
                    ? new long[]{0, now + LOGIN_LOCK_MS}
                    : new long[]{count, 0};
        });
    }

    public AuthenticationResponse verifyEmail(String token) {
        User user = repository.findByEmailVerificationToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired verification link"));
        if (user.getEmailVerificationTokenExpiresAt() != null &&
                Instant.now().isAfter(user.getEmailVerificationTokenExpiresAt())) {
            throw new IllegalArgumentException("This link has expired. Please request a new verification email.");
        }
        // If a pending email change is being confirmed, swap the login email to the (now verified) new address.
        if (user.getPendingEmail() != null && !user.getPendingEmail().isBlank()) {
            user.setEmail(user.getPendingEmail());
            user.setPendingEmail(null);
        }
        user.setEmailVerified(true);
        user.setEmailVerificationToken(null);
        user.setEmailVerificationTokenExpiresAt(null);
        repository.save(user);
        UUID tenantId = user.getTenant() != null ? user.getTenant().getId() : null;
        String jwtToken = jwtService.generateTokenWithId(user, user.getId(), tenantId);
        return AuthenticationResponse.builder().token(jwtToken).build();
    }

    /** Start an email change: store the new email as pending and email a confirmation link to it. The live
     *  login email is untouched until the user clicks the link (handled in verifyEmail above). */
    public void requestEmailChange(User user, String rawNewEmail) {
        if (rawNewEmail == null || rawNewEmail.isBlank())
            throw new IllegalArgumentException("A new email is required");
        String newEmail = rawNewEmail.trim().toLowerCase();
        if (newEmail.equalsIgnoreCase(user.getEmail()))
            throw new IllegalArgumentException("That is already your email");
        boolean taken = user.getTenant() != null
                ? repository.findByEmailAndTenant_Id(newEmail, user.getTenant().getId()).isPresent()
                : repository.findByEmailAndTenantIsNull(newEmail).isPresent();
        if (taken) throw new IllegalArgumentException("That email is already in use");
        String token = UUID.randomUUID().toString();
        user.setPendingEmail(newEmail);
        user.setEmailVerificationToken(token);
        user.setEmailVerificationTokenExpiresAt(Instant.now().plusSeconds(86400));
        repository.save(user);
        String verifyUrl = frontendUrl + "/verify-email?token=" + token;
        emailService.sendVerificationEmail(newEmail, newEmail, verifyUrl);
    }

    public void resendVerificationEmail(String email) {
        // Generic by design: never reveal whether the account exists or is already verified
        // (prevents account-enumeration). Silently no-op when there's nothing to send.
        User user = repository.findByEmail(email).orElse(null);
        if (user == null || user.isEmailVerified()) {
            return;
        }
        String token = UUID.randomUUID().toString();
        user.setEmailVerificationToken(token);
        user.setEmailVerificationTokenExpiresAt(Instant.now().plusSeconds(86400));
        repository.save(user);
        String verifyUrl = frontendUrl + "/verify-email?token=" + token;
        emailService.sendVerificationEmail(email, email, verifyUrl);
    }

    public User findById(UUID id) {
        User user = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found with ID: " + id));
        // A store admin may only read users in their OWN tenant; only SUPERADMIN sees across tenants.
        if (!isSuperadmin()) {
            UUID tenantId = TenantContext.getCurrentTenantId();
            UUID userTenant = user.getTenant() != null ? user.getTenant().getId() : null;
            if (tenantId == null || !tenantId.equals(userTenant)) {
                throw new IllegalArgumentException("User not found with ID: " + id);
            }
        }
        return user;
    }

    public List<User> getAllUsers() {
        // SUPERADMIN sees everyone; a store admin sees only their own tenant's users (no cross-tenant
        // directory leak of every store's customers/staff).
        if (isSuperadmin()) {
            return repository.findAll();
        }
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return java.util.List.of();
        return repository.findByTenant_Id(tenantId);
    }

    private static boolean isSuperadmin() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SUPERADMIN".equals(a.getAuthority()));
    }

    public void sendPasswordResetOtp(String email) {
        // Generic by design: never reveal whether the account exists (prevents enumeration).
        User user = repository.findByEmail(email).orElse(null);
        if (user == null) {
            return;
        }

        String otp = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        user.setResetOtp(otp);
        user.setResetOtpExpiresAt(Instant.now().plusSeconds(900)); // 15 minutes
        repository.save(user);

        String html = "<div style='font-family:sans-serif;padding:32px;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;'>"
                + "<h2 style='color:#111;'>Password Reset</h2>"
                + "<p style='color:#555;'>Your one-time password reset code is:</p>"
                + "<div style='font-size:36px;font-weight:bold;letter-spacing:8px;color:#111;padding:16px 0;'>" + otp + "</div>"
                + "<p style='color:#999;font-size:12px;'>This code expires in 15 minutes. If you didn't request this, ignore this email.</p>"
                + "</div>";

        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            emailService.sendRaw(user.getEmail(), "Your password reset code", html);
        }
    }

    public void resetPassword(String email, String otp, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
        // Generic error: never reveal whether the account exists.
        User user = repository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired OTP"));

        if (user.getResetOtp() == null || otp == null || !user.getResetOtp().equals(otp)) {
            throw new IllegalArgumentException("Invalid or expired OTP");
        }
        // Enforce the 15-minute lifetime that the email promises. Expired/used codes are cleared.
        if (user.getResetOtpExpiresAt() == null || Instant.now().isAfter(user.getResetOtpExpiresAt())) {
            user.setResetOtp(null);
            user.setResetOtpExpiresAt(null);
            repository.save(user);
            throw new IllegalArgumentException("Invalid or expired OTP");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetOtp(null);
        user.setResetOtpExpiresAt(null);
        repository.save(user);
    }

    public void changePassword(User user, String currentPassword, String newPassword) {
        if (currentPassword == null || newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("New password must be at least 6 characters");
        }
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        repository.save(user);
    }
}