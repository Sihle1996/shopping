package com.example.backend.service;

import com.example.backend.entity.PushSubscription;
import com.example.backend.repository.PushSubscriptionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.security.Security;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebPushService {

    @Value("${vapid.public-key:}")
    private String vapidPublicKey;

    @Value("${vapid.private-key:}")
    private String vapidPrivateKey;

    @Value("${vapid.subject:mailto:noreply@crave-it.co.za}")
    private String vapidSubject;

    private final PushSubscriptionRepository pushSubscriptionRepo;
    private final ObjectMapper objectMapper;

    private PushService pushService;
    private boolean enabled = false;

    @PostConstruct
    public void init() {
        if (vapidPublicKey.isBlank() || vapidPrivateKey.isBlank()) {
            log.info("VAPID keys not configured — push notifications disabled");
            return;
        }
        try {
            Security.addProvider(new BouncyCastleProvider());
            pushService = new PushService(vapidPublicKey, vapidPrivateKey, vapidSubject);
            enabled = true;
            log.info("Web Push Service initialised");
        } catch (Exception e) {
            log.warn("Failed to initialise Web Push Service: {}", e.getMessage());
        }
    }

    public void saveSubscription(UUID userId, String endpoint, String p256dh, String auth,
                                  com.example.backend.user.User user) {
        pushSubscriptionRepo.findByUser_IdAndEndpoint(userId, endpoint).ifPresentOrElse(
                existing -> {
                    existing.setP256dh(p256dh);
                    existing.setAuth(auth);
                    pushSubscriptionRepo.save(existing);
                },
                () -> {
                    PushSubscription sub = new PushSubscription();
                    sub.setUser(user);
                    sub.setEndpoint(endpoint);
                    sub.setP256dh(p256dh);
                    sub.setAuth(auth);
                    pushSubscriptionRepo.save(sub);
                }
        );
    }

    public void deleteSubscription(String endpoint) {
        pushSubscriptionRepo.deleteByEndpoint(endpoint);
    }

    @Async
    public void sendToUser(UUID userId, String title, String body) {
        if (!enabled) return;
        List<PushSubscription> subs = pushSubscriptionRepo.findByUser_Id(userId);
        for (PushSubscription sub : subs) {
            try {
                String payload = objectMapper.writeValueAsString(Map.of("title", title, "body", body));
                Notification notification = new Notification(sub.getEndpoint(), sub.getP256dh(), sub.getAuth(), payload);
                pushService.send(notification);
            } catch (Exception e) {
                log.warn("Push send failed for sub {}: {}", sub.getId(), e.getMessage());
                // Remove expired/invalid subscriptions
                if (e.getMessage() != null && (e.getMessage().contains("410") || e.getMessage().contains("404"))) {
                    pushSubscriptionRepo.delete(sub);
                }
            }
        }
    }
}
