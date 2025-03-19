package com.example.backend.auth;

import com.example.backend.config.JwtService;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthenticationService {

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthenticationResponse register(RegisterRequest request) {
        // Check if the user already exists
        repository.findByEmail(request.getEmail())
                .ifPresent(user -> {
                    throw new IllegalArgumentException("User with email " + request.getEmail() + " already exists");
                });

        // Hash the password only once during registration
        String hashedPassword = passwordEncoder.encode(request.getPassword());

        // Create and save the user
        User user = User.builder()
                .email(request.getEmail())
                .password(hashedPassword) // Save hashed password
                .role(Role.USER) // Default to USER role
                .build();

        user = repository.save(user);

        // Generate JWT token
        String jwtToken = jwtService.generateTokenWithId(user, user.getId());

        // Return the token in the response
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .build();
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        // Authenticate the user
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        // Retrieve the user after successful authentication
        User user = repository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        // Generate JWT token
        String jwtToken = jwtService.generateTokenWithId(user, user.getId());

        // Return the token in the response
        return AuthenticationResponse.builder()
                .token(jwtToken)
                .build();
    }

    public User findById(Long id) {
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