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

        // ✅ Use constructor instead of User.builder()
        User user = new User(request.getEmail(), hashedPassword, Role.USER);

        user = repository.save(user);

        // Generate JWT token
        String jwtToken = jwtService.generateTokenWithId(user, user.getId());

        // ✅ Directly return new AuthenticationResponse object
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

        // Retrieve the user after successful authentication
        User user = repository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        // Generate JWT token
        String jwtToken = jwtService.generateTokenWithId(user, user.getId());

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
