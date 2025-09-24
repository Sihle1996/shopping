package com.example.backend.service;

import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.Notification;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@Slf4j
public class PushNotificationService {

    public void sendToToken(String token, String title, String body) {
        try {
            Message message = Message.builder()
                    .setToken(token)
                    .setNotification(Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build())
                    .build();
            String id = FirebaseMessaging.getInstance().send(message);
            log.info("Sent push to token={}, messageId={}", token, id);
        } catch (Exception e) {
            log.warn("Failed to send push to token {}: {}", token, e.getMessage());
        }
    }

    public void sendToTokens(List<String> tokens, String title, String body) {
        if (tokens == null || tokens.isEmpty()) return;
        int success = 0;
        int failure = 0;
        for (String t : tokens) {
            try {
                sendToToken(t, title, body);
                success++;
            } catch (Exception e) {
                failure++;
            }
        }
        log.info("Push multi (iterative): success={}, failure={} for {} tokens", success, failure, tokens.size());
    }
}
