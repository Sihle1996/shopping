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

import java.math.BigDecimal;
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
    private final AuditService auditService;
    private final DriverLedgerService driverLedgerService;

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
        auditService.log(AuditService.ADMIN, "DRIVER_CREATED", "DRIVER", saved.getId(), "Added driver " + saved.getEmail());

        String storeName = saved.getTenant() != null ? saved.getTenant().getName() : "CraveIt";
        emailService.sendDriverWelcomeEmail(
                saved.getEmail(), request.getPassword(), storeName, frontendUrl + "/login");

        return new DriverDTO(saved.getId(), saved.getEmail(), saved.getDriverStatus(), 0.0);
    }

    public List<DriverDTO> getAllDrivers() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) throw new SecurityException("Tenant context required");
        return userRepository.findByRoleAndTenant_Id(Role.DRIVER, tenantId).stream()
                .map(u -> new DriverDTO(u.getId(), u.getEmail(), u.getDriverStatus(),
                        driverLedgerService.owedBalance(u.getId()).doubleValue()))
                .toList();
    }

    /** Settlement: the store paid this driver, debiting their owed balance. Tenant-scoped. */
    public DriverDTO recordPayout(UUID driverId, BigDecimal amount, String note) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        User driver = (tenantId != null
                ? userRepository.findByIdAndTenant_Id(driverId, tenantId)
                : userRepository.findById(driverId))
                .orElseThrow(() -> new RuntimeException("Driver not found"));
        if (driver.getRole() != Role.DRIVER) throw new RuntimeException("User is not a driver");
        if (amount == null || amount.signum() <= 0) throw new IllegalArgumentException("Payout amount must be greater than 0.");
        BigDecimal owed = driverLedgerService.owedBalance(driverId);
        if (amount.compareTo(owed) > 0) throw new IllegalArgumentException("Payout can't exceed the owed balance of R" + owed);

        driverLedgerService.recordDriverPayout(driver, amount, note);
        auditService.log(AuditService.ADMIN, "DRIVER_PAYOUT", "DRIVER", driverId, "Paid driver R" + amount);
        return new DriverDTO(driver.getId(), driver.getEmail(), driver.getDriverStatus(),
                driverLedgerService.owedBalance(driverId).doubleValue());
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
        auditService.log(AuditService.ADMIN, "DRIVER_DELETED", "DRIVER", id, "Removed driver " + driver.getEmail());
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
