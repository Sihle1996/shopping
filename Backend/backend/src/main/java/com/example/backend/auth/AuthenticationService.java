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

import java.time.Instant;
import java.util.List;
import java.util.Random;
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

    public AuthenticationResponse register(RegisterRequest request, UUID tenantId) {
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
        }

        // Create and save the user — ADMIN if registering with a tenant, USER otherwise
        Role assignedRole = (tenant != null) ? Role.ADMIN : Role.USER;

        User user;
        if (tenant != null) {
            // Admin registration — skip email verification, auto-login immediately
            user = User.builder()
                    .email(request.getEmail())
                    .password(hashedPassword)
                    .role(assignedRole)
                    .tenant(tenant)
                    .emailVerified(true)
                    .build();
            user = repository.save(user);
            UUID userTenantId = tenant.getId();
            String jwtToken = jwtService.generateTokenWithId(user, user.getId(), userTenantId);
            return AuthenticationResponse.builder().token(jwtToken).build();
        }

        // Customer registration — require email verification
        String verificationToken = UUID.randomUUID().toString();
        user = User.builder()
                .email(request.getEmail())
                .password(hashedPassword)
                .role(assignedRole)
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
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        UUID tenantId = TenantContext.getCurrentTenantId();
        User user = (tenantId != null)
                ? repository.findByEmailAndTenant_Id(request.getEmail(), tenantId)
                        .or(() -> repository.findByEmailAndTenantIsNull(request.getEmail()))
                        .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"))
                : repository.findByEmail(request.getEmail())
                        .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        UUID userTenantId = user.getTenant() != null ? user.getTenant().getId() : null;
        String jwtToken = jwtService.generateTokenWithId(user, user.getId(), userTenantId);

        return AuthenticationResponse.builder()
                .token(jwtToken)
                .build();
    }

    public AuthenticationResponse verifyEmail(String token) {
        User user = repository.findByEmailVerificationToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired verification link"));
        if (user.getEmailVerificationTokenExpiresAt() != null &&
                Instant.now().isAfter(user.getEmailVerificationTokenExpiresAt())) {
            throw new IllegalArgumentException("This link has expired. Please request a new verification email.");
        }
        user.setEmailVerified(true);
        user.setEmailVerificationToken(null);
        user.setEmailVerificationTokenExpiresAt(null);
        repository.save(user);
        UUID tenantId = user.getTenant() != null ? user.getTenant().getId() : null;
        String jwtToken = jwtService.generateTokenWithId(user, user.getId(), tenantId);
        return AuthenticationResponse.builder().token(jwtToken).build();
    }

    public void resendVerificationEmail(String email) {
        User user = repository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("No account found with that email"));
        if (user.isEmailVerified()) {
            throw new IllegalArgumentException("This account is already verified");
        }
        String token = UUID.randomUUID().toString();
        user.setEmailVerificationToken(token);
        user.setEmailVerificationTokenExpiresAt(Instant.now().plusSeconds(86400));
        repository.save(user);
        String verifyUrl = frontendUrl + "/verify-email?token=" + token;
        emailService.sendVerificationEmail(email, email, verifyUrl);
    }

    public User findById(UUID id) {
        // Retrieve a user by ID
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found with ID: " + id));
    }

    public List<User> getAllUsers() {
        try {
            return repository.findAll();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to fetch users", e);
        }
    }

    public void sendPasswordResetOtp(String email) {
        User user = repository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("No account found with that email"));

        String otp = String.format("%06d", new Random().nextInt(999999));
        user.setResetOtp(otp);
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
        User user = repository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("No account found with that email"));

        if (user.getResetOtp() == null || !user.getResetOtp().equals(otp)) {
            throw new IllegalArgumentException("Invalid or expired OTP");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetOtp(null);
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