package com.example.backend.auth;

import com.example.backend.config.JwtService;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

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

    public AuthenticationResponse register(RegisterRequest request, UUID tenantId) {
        // Check if the user already exists
        repository.findByEmail(request.getEmail())
                .ifPresent(user -> {
                    throw new IllegalArgumentException("User with email " + request.getEmail() + " already exists");
                });

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

        User user = User.builder()
                .email(request.getEmail())
                .password(hashedPassword)
                .role(assignedRole)
                .tenant(tenant)
                .build();

        user = repository.save(user);

        // Generate JWT token with tenantId
        UUID userTenantId = tenant != null ? tenant.getId() : null;
        String jwtToken = jwtService.generateTokenWithId(user, user.getId(), userTenantId);

        // Return the token in the response
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .build();
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        User user = repository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        UUID tenantId = user.getTenant() != null ? user.getTenant().getId() : null;
        String jwtToken = jwtService.generateTokenWithId(user, user.getId(), tenantId);

        // Return the token in the response
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .build();
    }

    public User findById(UUID id) {
        // Retrieve a user by ID
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found with ID: " + id));
    }

    public List<User> getAllUsers() {
        // Retrieve all users
        try {
            return repository.findAll();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to fetch users", e);
        }
    }
}