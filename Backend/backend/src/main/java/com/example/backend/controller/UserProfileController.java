package com.example.backend.controller;

import com.example.backend.config.AuthUtil;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserRepository userRepository;
    private final AuthUtil authUtil;

    @GetMapping
    public ResponseEntity<ProfileResponse> getProfile(Authentication authentication) {
        User user = authUtil.getCurrentUser(authentication);
        return ResponseEntity.ok(ProfileResponse.from(user));
    }

    @PutMapping
    public ResponseEntity<ProfileResponse> updateProfile(
            @RequestBody ProfileRequest req,
            Authentication authentication) {
        User user = authUtil.getCurrentUser(authentication);
        if (req.fullName() != null) user.setFullName(req.fullName());
        if (req.phone() != null) user.setPhone(req.phone());
        if (req.marketingEmailOptIn() != null) user.setMarketingEmailOptIn(req.marketingEmailOptIn());
        userRepository.save(user);
        return ResponseEntity.ok(ProfileResponse.from(user));
    }

    @DeleteMapping("/account")
    public ResponseEntity<Void> deleteAccount(Authentication authentication) {
        User user = authUtil.getCurrentUser(authentication);
        String anon = "deleted-" + UUID.randomUUID();
        user.setEmail(anon + "@removed.local");
        user.setFullName(null);
        user.setPhone(null);
        user.setPassword("");
        user.setActive(false);
        user.setMarketingEmailOptIn(false);
        userRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    record ProfileRequest(String fullName, String phone, Boolean marketingEmailOptIn) {}

    record ProfileResponse(String email, String fullName, String phone, String role, boolean marketingEmailOptIn) {
        static ProfileResponse from(User u) {
            return new ProfileResponse(
                u.getEmail(), u.getFullName(), u.getPhone(),
                u.getRole() != null ? u.getRole().name() : null,
                u.isMarketingEmailOptIn()
            );
        }
    }
}
