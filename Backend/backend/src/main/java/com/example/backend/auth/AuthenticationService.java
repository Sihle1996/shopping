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

        // Hash the password
        String hashedPassword = passwordEncoder.encode(request.getPassword());

        // ✅ Corrected user creation
        User user = new User(request.getEmail(), hashedPassword, Role.USER);
        user = repository.save(user); // ✅ Save to database

        // ✅ Ensure correct method is used for JWT generation
        String jwtToken = jwtService.generateToken(user);

        return new AuthenticationResponse(jwtToken);
    }

    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        // Authenticate the user
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        // ✅ Fetch the authenticated user
        User user = repository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        // ✅ Corrected JWT token generation
        String jwtToken = jwtService.generateToken(user);

        return new AuthenticationResponse(jwtToken);
    }

    public User findById(Long id) {
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
}
