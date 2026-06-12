package com.example.backend.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@Service
public class CloudinaryService {

    private final Cloudinary cloudinary;
    private final boolean configured;
    private final String backendUrl;

    public CloudinaryService(
            @Value("${cloudinary.cloud-name}") String cloudName,
            @Value("${cloudinary.api-key}") String apiKey,
            @Value("${cloudinary.api-secret}") String apiSecret,
            @Value("${app.backend-url:http://localhost:8080}") String backendUrl) {
        // "local" placeholders (or blanks) mean Cloudinary isn't set up — fall back to disk.
        this.configured = cloudName != null && !cloudName.isBlank()
                && !"local".equalsIgnoreCase(cloudName) && !"local".equalsIgnoreCase(apiKey);
        this.backendUrl = backendUrl;
        this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret,
                "secure", true
        ));
    }

    public String upload(MultipartFile file) throws IOException {
        if (configured) {
            Map<?, ?> result = cloudinary.uploader().upload(file.getBytes(),
                    ObjectUtils.asMap("folder", "shopping"));
            return (String) result.get("secure_url");
        }
        // Cloudinary not configured (local dev, or a transient outage): persist to the
        // uploads/ dir — served via spring.web.resources.static-locations=file:uploads/ —
        // so uploads don't 500 and onboarding can proceed without Cloudinary creds (B1).
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        int dot = original.lastIndexOf('.');
        String ext = dot >= 0 ? original.substring(dot).replaceAll("[^.A-Za-z0-9]", "") : "";
        String filename = "upload-" + UUID.randomUUID() + ext;
        Path dir = Paths.get("uploads");
        Files.createDirectories(dir);
        Files.write(dir.resolve(filename), file.getBytes());
        return backendUrl + "/" + filename;
    }
}
