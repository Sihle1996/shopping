package com.example.backend.controller;

import com.example.backend.auth.AuthenticationService;
import com.example.backend.config.AuthUtil;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserRepository userRepository;
    private final AuthUtil authUtil;
    private final AuthenticationService authenticationService;

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

    /** Start an email change — emails a confirmation link to the NEW address; the login email isn't changed
     *  until the link is clicked. */
    @PostMapping("/change-email")
    public ResponseEntity<?> changeEmail(@RequestBody Map<String, String> body, Authentication authentication) {
        User user = authUtil.getCurrentUser(authentication);
        try {
            authenticationService.requestEmailChange(user, body.get("email"));
            return ResponseEntity.ok(Map.of("message", "Check your new email inbox to confirm the change."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
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
