package com.example.backend.controller;

import com.example.backend.repository.UserRepository;
import com.example.backend.user.User;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final UserRepository userRepository;

    public record RegisterTokenRequest(@NotBlank String token) {}

    @PostMapping("/register-fcm")
    public ResponseEntity<?> registerFcm(@RequestBody RegisterTokenRequest req, Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        var user = userRepository.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(404).body("User not found");
        user.setFcmToken(req.token());
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @DeleteMapping("/register-fcm")
    public ResponseEntity<?> unregisterFcm(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        var user = userRepository.findByEmail(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(404).body("User not found");
        user.setFcmToken(null);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
