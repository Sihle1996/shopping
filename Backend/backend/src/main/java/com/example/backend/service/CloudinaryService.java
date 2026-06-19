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

    /** Max accepted upload size (10MB). */
    private static final long MAX_UPLOAD_BYTES = 10L * 1024 * 1024;

    public String upload(MultipartFile file) throws IOException {
        // Validate content-type, size and magic bytes BEFORE doing anything with the file.
        // Returns the safe, server-chosen extension for the validated type.
        byte[] bytes = file.getBytes();
        String safeExt = validate(file, bytes);

        if (configured) {
            Map<?, ?> result = cloudinary.uploader().upload(bytes,
                    ObjectUtils.asMap("folder", "shopping"));
            return (String) result.get("secure_url");
        }
        // Cloudinary not configured (local dev, or a transient outage): persist to the
        // uploads/ dir — served via spring.web.resources.static-locations=file:uploads/ —
        // so uploads don't 500 and onboarding can proceed without Cloudinary creds (B1).
        // The extension is derived ONLY from the validated content-type, never the client
        // filename, so a hostile filename can't smuggle an .svg/.html into a served dir.
        String filename = "upload-" + UUID.randomUUID() + safeExt;
        Path dir = Paths.get("uploads");
        Files.createDirectories(dir);
        Files.write(dir.resolve(filename), bytes);
        return backendUrl + "/" + filename;
    }

    /**
     * Allow ONLY pdf/png/jpeg/webp. Checks the declared content-type against the allowlist
     * AND sniffs the leading magic bytes so a renamed/relabelled file (e.g. an SVG or HTML
     * payload sent as image/png) is rejected. Enforces a 10MB cap. Returns the safe extension
     * to use for the validated type. Throws IllegalArgumentException on anything else.
     */
    private String validate(MultipartFile file, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("Empty file.");
        }
        if (bytes.length > MAX_UPLOAD_BYTES) {
            throw new IllegalArgumentException("File too large (max 10MB).");
        }
        String declared = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        String sniffed = sniff(bytes);
        if (sniffed == null) {
            throw new IllegalArgumentException("Unsupported or corrupt file type.");
        }
        // The declared content-type must also be in the allowlist and agree with the bytes.
        // jpeg may be declared as image/jpeg or image/jpg.
        boolean declaredOk = switch (sniffed) {
            case "application/pdf" -> declared.equals("application/pdf");
            case "image/png" -> declared.equals("image/png");
            case "image/jpeg" -> declared.equals("image/jpeg") || declared.equals("image/jpg");
            case "image/webp" -> declared.equals("image/webp");
            default -> false;
        };
        if (!declaredOk) {
            throw new IllegalArgumentException("File content does not match an allowed type "
                    + "(pdf, png, jpeg, webp only).");
        }
        return switch (sniffed) {
            case "application/pdf" -> ".pdf";
            case "image/png" -> ".png";
            case "image/jpeg" -> ".jpg";
            case "image/webp" -> ".webp";
            default -> throw new IllegalArgumentException("Unsupported file type.");
        };
    }

    /** Return the canonical content-type sniffed from leading magic bytes, or null if unknown. */
    private String sniff(byte[] b) {
        if (b.length >= 5 && b[0] == 0x25 && b[1] == 0x50 && b[2] == 0x44 && b[3] == 0x46
                && b[4] == 0x2D) { // "%PDF-"
            return "application/pdf";
        }
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47
                && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) { // PNG signature
            return "image/png";
        }
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) { // JPEG SOI
            return "image/jpeg";
        }
        if (b.length >= 12 && b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46 // "RIFF"
                && b[8] == 0x57 && b[9] == 0x45 && b[10] == 0x42 && b[11] == 0x50) { // "WEBP"
            return "image/webp";
        }
        return null;
    }
}
