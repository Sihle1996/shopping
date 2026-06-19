package com.example.backend.config;

import com.example.backend.repository.UserRepository;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuthUtil {

    private final UserRepository userRepository;

    public User getCurrentUser(Authentication authentication) {
        // The authenticated principal IS the loaded User — return it directly. Re-looking-up by email
        // would throw when the same email exists across tenants (email is only unique per-tenant).
        if (authentication != null && authentication.getPrincipal() instanceof User u) {
            return u;
        }
        String email = authentication.getName();
        return userRepository.findAllByEmail(email).stream().findFirst()
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}