package com.example.backend.service;

import com.example.backend.auth.RegisterRequest;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.DriverStatus;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminDriverServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AdminDriverService adminDriverService;

    @Test
    void createDriverStoresEncodedPasswordAndRole() {
        RegisterRequest request = mock(RegisterRequest.class);
        when(request.getEmail()).thenReturn("driver@example.com");
        when(request.getPassword()).thenReturn("secret");
        when(userRepository.findByEmail("driver@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("secret")).thenReturn("encoded");

        User saved = User.builder()
                .id(1L)
                .email("driver@example.com")
                .password("encoded")
                .role(Role.DRIVER)
                .driverStatus(DriverStatus.AVAILABLE)
                .build();
        when(userRepository.save(any(User.class))).thenReturn(saved);

        User result = adminDriverService.createDriver(request);

        assertEquals(Role.DRIVER, result.getRole());
        assertEquals(DriverStatus.AVAILABLE, result.getDriverStatus());
        assertEquals("encoded", result.getPassword());

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals("driver@example.com", captor.getValue().getEmail());
    }

    @Test
    void createDriverThrowsWhenEmailExists() {
        RegisterRequest request = mock(RegisterRequest.class);
        when(request.getEmail()).thenReturn("driver@example.com");
        when(userRepository.findByEmail("driver@example.com")).thenReturn(Optional.of(new User()));

        assertThrows(IllegalArgumentException.class, () -> adminDriverService.createDriver(request));
    }

    @Test
    void getAllDriversReturnsList() {
        List<User> drivers = List.of(new User());
        when(userRepository.findByRole(Role.DRIVER)).thenReturn(drivers);

        assertEquals(drivers, adminDriverService.getAllDrivers());
    }

    @Test
    void deleteDriverRemovesExistingDriver() {
        when(userRepository.existsById(1L)).thenReturn(true);

        adminDriverService.deleteDriver(1L);

        verify(userRepository).deleteById(1L);
    }

    @Test
    void deleteDriverThrowsWhenNotFound() {
        when(userRepository.existsById(1L)).thenReturn(false);

        assertThrows(RuntimeException.class, () -> adminDriverService.deleteDriver(1L));
    }
}

