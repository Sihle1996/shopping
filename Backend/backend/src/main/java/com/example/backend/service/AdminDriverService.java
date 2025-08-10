package com.example.backend.service;

import com.example.backend.auth.RegisterRequest;
import com.example.backend.entity.DriverDTO;
import com.example.backend.entity.DriverLocationDTO;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.DriverStatus;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import com.example.backend.config.EmailAlreadyExistsException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminDriverService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DriverDTO createDriver(RegisterRequest request) {
        userRepository.findByEmail(request.getEmail())
                .ifPresent(u -> {
                    throw new EmailAlreadyExistsException("Email already exists");
                });

        User driver = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.DRIVER)
                .driverStatus(DriverStatus.AVAILABLE)
                .build();

        User saved = userRepository.save(driver);
        return new DriverDTO(saved.getId(), saved.getEmail(), saved.getDriverStatus());
    }

    public List<DriverDTO> getAllDrivers() {
        return userRepository.findByRole(Role.DRIVER).stream()
                .map(u -> new DriverDTO(u.getId(), u.getEmail(), u.getDriverStatus()))
                .toList();
    }

  public void deleteDriver(Long id) {
      if (!userRepository.existsById(id)) {
          throw new RuntimeException("Driver not found");
      }
      userRepository.deleteById(id);
  }

  public List<DriverLocationDTO> getDriverLocations() {
      return userRepository.findByRole(Role.DRIVER).stream()
              .map(u -> new DriverLocationDTO(
                      u.getId(),
                      u.getEmail(),
                      u.getDriverStatus(),
                      u.getLatitude(),
                      u.getLongitude(),
                      u.getSpeed(),
                      u.getLastPing()
              ))
              .collect(Collectors.toList());
  }
}

