package com.example.backend.service;

import com.example.backend.auth.RegisterRequest;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.DriverStatus;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminDriverService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public User createDriver(RegisterRequest request) {
        userRepository.findByEmail(request.getEmail())
                .ifPresent(u -> {
                    throw new IllegalArgumentException("Email already exists");
                });

        User driver = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.DRIVER)
                .driverStatus(DriverStatus.AVAILABLE)
                .build();

        return userRepository.save(driver);
    }

    public List<User> getAllDrivers() {
        return userRepository.findByRole(Role.DRIVER);
    }

    public void deleteDriver(Long id) {
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("Driver not found");
        }
        userRepository.deleteById(id);
    }
}

