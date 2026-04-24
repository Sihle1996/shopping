package com.example.backend.controller;

import com.example.backend.entity.NotificationPreference;
import com.example.backend.repository.NotificationPreferenceRepository;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/notification-preferences")
@PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
@RequiredArgsConstructor
public class NotificationPreferenceController {

    private final NotificationPreferenceRepository prefRepository;

    @GetMapping
    public ResponseEntity<NotificationPreference> get(@AuthenticationPrincipal User user) {
        NotificationPreference prefs = prefRepository.findByUser_Id(user.getId())
                .orElseGet(() -> {
                    NotificationPreference p = new NotificationPreference();
                    p.setUser(user);
                    return prefRepository.save(p);
                });
        return ResponseEntity.ok(prefs);
    }

    @PutMapping
    public ResponseEntity<NotificationPreference> save(@AuthenticationPrincipal User user,
                                                       @RequestBody Map<String, Boolean> body) {
        NotificationPreference prefs = prefRepository.findByUser_Id(user.getId())
                .orElseGet(() -> { NotificationPreference p = new NotificationPreference(); p.setUser(user); return p; });

        if (body.containsKey("emailOnNewOrder"))       prefs.setEmailOnNewOrder(body.get("emailOnNewOrder"));
        if (body.containsKey("emailOnCancellation"))   prefs.setEmailOnCancellation(body.get("emailOnCancellation"));
        if (body.containsKey("emailOnDriverAssigned")) prefs.setEmailOnDriverAssigned(body.get("emailOnDriverAssigned"));
        if (body.containsKey("toastOnNewOrder"))       prefs.setToastOnNewOrder(body.get("toastOnNewOrder"));
        if (body.containsKey("toastOnStatusChange"))   prefs.setToastOnStatusChange(body.get("toastOnStatusChange"));

        return ResponseEntity.ok(prefRepository.save(prefs));
    }
}
