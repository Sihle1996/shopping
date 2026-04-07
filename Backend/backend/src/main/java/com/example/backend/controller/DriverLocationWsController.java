package com.example.backend.controller;

import com.example.backend.entity.DriverLocationDTO;
import com.example.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.Instant;

@Controller
@RequiredArgsConstructor
public class DriverLocationWsController {
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/drivers")
    public void updateLocation(DriverLocationDTO location) {
        location.setLastPing(Instant.now());
        userRepository.findById(location.getId()).ifPresent(user -> {
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
