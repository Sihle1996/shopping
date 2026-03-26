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

    public DriverDTO createDriver(RegisterRequest request) {
        userRepository.findByEmail(request.getEmail())
                .ifPresent(u -> {
                    throw new EmailAlreadyExistsException("Email already exists");
                });

        User.UserBuilder builder = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.DRIVER)
                .driverStatus(DriverStatus.AVAILABLE);

        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            Tenant tenant = tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new RuntimeException("Tenant not found"));
            builder.tenant(tenant);
        }

        User saved = userRepository.save(builder.build());
        return new DriverDTO(saved.getId(), saved.getEmail(), saved.getDriverStatus());
    }

    public List<DriverDTO> getAllDrivers() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<User> drivers;
        if (tenantId != null) {
            drivers = userRepository.findByRoleAndTenant_Id(Role.DRIVER, tenantId);
        } else {
            drivers = userRepository.findByRole(Role.DRIVER);
        }
        return drivers.stream()
                .map(u -> new DriverDTO(u.getId(), u.getEmail(), u.getDriverStatus()))
                .toList();
    }

    public void deleteDriver(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("Driver not found");
        }
        userRepository.deleteById(id);
    }

    public List<DriverLocationDTO> getDriverLocations() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<User> drivers;
        if (tenantId != null) {
            drivers = userRepository.findByRoleAndTenant_Id(Role.DRIVER, tenantId);
        } else {
            drivers = userRepository.findByRole(Role.DRIVER);
        }
        return drivers.stream()
                .map(u -> new DriverLocationDTO(
                        u.getId(), u.getEmail(), u.getDriverStatus(),
                        u.getLatitude(), u.getLongitude(), u.getSpeed(), u.getLastPing()
                ))
                .collect(Collectors.toList());
    }
}
