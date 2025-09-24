package com.example.backend.controller;

import com.example.backend.repository.UserRepository;
import com.example.backend.service.PushNotificationService;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/push")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminPushController {

    private final UserRepository userRepository;
    private final PushNotificationService pushService;

    public record SendRequest(@NotBlank String title, @NotBlank String body) {}

    @PostMapping("/send")
    public ResponseEntity<?> sendToOptedIn(@RequestBody SendRequest req) {
        var users = userRepository.findByPromoOptInTrueAndFcmTokenIsNotNull();
        List<String> tokens = users.stream()
                .map(u -> u.getFcmToken())
                .filter(t -> t != null && !t.isBlank())
                .toList();
        pushService.sendToTokens(tokens, req.title(), req.body());
        return ResponseEntity.ok(Map.of(
                "recipients", tokens.size(),
                "status", "queued"
        ));
    }
}
