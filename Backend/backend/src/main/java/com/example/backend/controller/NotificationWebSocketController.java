package com.example.backend.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class NotificationWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/admin/notify")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public void broadcast(String message) {
        messagingTemplate.convertAndSend("/topic/admin/notifications", message);
    }
}
