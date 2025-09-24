package com.example.backend.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

@Configuration
@Slf4j
public class FirebaseConfig {

    @Value("${firebase.credentials.file:}")
    private String serviceAccountFile;

    @PostConstruct
    public void init() {
        try {
            if (!FirebaseApp.getApps().isEmpty()) return;

            GoogleCredentials credentials = null;
            if (serviceAccountFile != null && !serviceAccountFile.isBlank()) {
                try (InputStream serviceAccount = new FileInputStream(serviceAccountFile)) {
                    credentials = GoogleCredentials.fromStream(serviceAccount);
                }
            } else {
                // Fallback to GOOGLE_APPLICATION_CREDENTIALS or default credentials
                credentials = GoogleCredentials.getApplicationDefault();
            }

            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(credentials)
                    .build();
            FirebaseApp.initializeApp(options);
            log.info("Firebase initialized using {}", (serviceAccountFile == null || serviceAccountFile.isBlank()) ? "application default credentials" : serviceAccountFile);
        } catch (IOException e) {
            log.error("Failed to initialize Firebase: {}", e.getMessage(), e);
        }
    }
}
