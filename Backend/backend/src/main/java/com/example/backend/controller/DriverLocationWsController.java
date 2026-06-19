package com.example.backend.controller;

import com.example.backend.entity.DriverLocationDTO;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class DriverLocationWsController {
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/drivers")
    public void updateLocation(DriverLocationDTO location, Principal principal) {
        // Identity comes from the authenticated session (set at CONNECT), NEVER the body's id —
        // otherwise anyone could write GPS onto an arbitrary user row and spoof driver positions.
        if (principal == null) return;
        UUID driverId;
        try {
            driverId = UUID.fromString(principal.getName());
        } catch (IllegalArgumentException e) {
            return;
        }
        location.setLastPing(Instant.now());
        userRepository.findById(driverId).ifPresent(user -> {
            if (user.getRole() != Role.DRIVER) return; // only an actual driver may post a location
            location.setId(driverId);
            user.setLatitude(location.getLatitude());
            user.setLongitude(location.getLongitude());
            user.setSpeed(location.getSpeed());
            user.setLastPing(Instant.now());
            userRepository.save(user);

            String topic = user.getTenant() != null
                    ? "/topic/drivers/" + user.getTenant().getId()
                    : "/topic/drivers";
            messagingTemplate.convertAndSend(topic, location);
        });
    }
}
