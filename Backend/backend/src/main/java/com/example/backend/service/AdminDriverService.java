package com.example.backend.service;

import com.example.backend.auth.RegisterRequest;
import com.example.backend.entity.DriverDTO;
import com.example.backend.entity.DriverLocationDTO;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.TenantRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.DriverStatus;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import com.example.backend.config.EmailAlreadyExistsException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminDriverService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TenantRepository tenantRepository;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final EmailService emailService;

    @Value("${app.frontend-url:http://localhost:4200}")
    private String frontendUrl;

    public DriverDTO createDriver(RegisterRequest request) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            subscriptionEnforcementService.assertDriverLimit(tenantId);
        }

        userRepository.findByEmail(request.getEmail())
                .ifPresent(u -> {
                    throw new EmailAlreadyExistsException("Email already exists");
                });

        User.UserBuilder builder = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.DRIVER)
                .driverStatus(DriverStatus.AVAILABLE);

        if (tenantId != null) {
            Tenant tenant = tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new RuntimeException("Tenant not found"));
            builder.tenant(tenant);
        }

        User saved = userRepository.save(builder.build());

        String storeName = saved.getTenant() != null ? saved.getTenant().getName() : "CraveIt";
        emailService.sendDriverWelcomeEmail(
                saved.getEmail(), request.getPassword(), storeName, frontendUrl + "/login");

        return new DriverDTO(saved.getId(), saved.getEmail(), saved.getDriverStatus());
    }

    public List<DriverDTO> getAllDrivers() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) throw new SecurityException("Tenant context required");
        return userRepository.findByRoleAndTenant_Id(Role.DRIVER, tenantId).stream()
                .map(u -> new DriverDTO(u.getId(), u.getEmail(), u.getDriverStatus()))
                .toList();
    }

    public void deleteDriver(UUID id) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        User driver = (tenantId != null
                ? userRepository.findByIdAndTenant_Id(id, tenantId)
                : userRepository.findById(id))
                .orElseThrow(() -> new RuntimeException("Driver not found"));
        if (driver.getRole() != Role.DRIVER) {
            throw new RuntimeException("User is not a driver");
        }
        userRepository.delete(driver);
    }

    public List<DriverLocationDTO> getDriverLocations() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) throw new SecurityException("Tenant context required");
        return userRepository.findByRoleAndTenant_Id(Role.DRIVER, tenantId).stream()
                .map(u -> new DriverLocationDTO(
                        u.getId(), u.getEmail(), u.getDriverStatus(),
                        u.getLatitude(), u.getLongitude(), u.getSpeed(), u.getLastPing()
                ))
                .collect(Collectors.toList());
    }
}
