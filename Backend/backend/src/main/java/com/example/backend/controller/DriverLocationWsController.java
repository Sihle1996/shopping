package com.example.backend.controller;

import com.example.backend.entity.DriverLocationDTO;
import com.example.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import java.time.Instant;

@Controller
@RequiredArgsConstructor
public class DriverLocationWsController {
    private final UserRepository userRepository;

    @MessageMapping("/drivers")
    @SendTo("/topic/drivers")
    public DriverLocationDTO updateLocation(DriverLocationDTO location) {
        userRepository.findById(location.getId()).ifPresent(user -> {
            user.setLatitude(location.getLatitude());
            user.setLongitude(location.getLongitude());
            user.setSpeed(location.getSpeed());
            user.setLastPing(Instant.now());
            userRepository.save(user);
        });
        location.setLastPing(Instant.now());
        return location;
    }
}
