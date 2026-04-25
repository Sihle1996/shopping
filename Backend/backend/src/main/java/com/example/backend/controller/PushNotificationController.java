package com.example.backend.controller;

import com.example.backend.service.WebPushService;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushNotificationController {

    private final WebPushService webPushService;

    @Value("${vapid.public-key:}")
    private String vapidPublicKey;

    @GetMapping("/public-key")
    public ResponseEntity<?> getPublicKey() {
        return ResponseEntity.ok(Map.of("publicKey", vapidPublicKey));
    }

    @PostMapping("/subscribe")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> subscribe(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {
        String endpoint = body.get("endpoint");
        String p256dh = body.get("p256dh");
        String auth = body.get("auth");
        if (endpoint == null || p256dh == null || auth == null)
            return ResponseEntity.badRequest().body("endpoint, p256dh and auth are required");
        webPushService.saveSubscription(user.getId(), endpoint, p256dh, auth, user);
        return ResponseEntity.ok(Map.of("subscribed", true));
    }

    @DeleteMapping("/unsubscribe")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> unsubscribe(@RequestBody Map<String, String> body) {
        String endpoint = body.get("endpoint");
        if (endpoint != null) webPushService.deleteSubscription(endpoint);
        return ResponseEntity.noContent().build();
    }
}
