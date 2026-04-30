package com.example.backend.controller;

import com.example.backend.dto.AiDescribeItemRequest;
import com.example.backend.service.AdminAiService;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAiController {

    private final AdminAiService adminAiService;

    /** POST /api/admin/ai/describe-item — generate description + tags for a menu item */
    @PostMapping("/describe-item")
    public ResponseEntity<Map<String, Object>> describeItem(@RequestBody AiDescribeItemRequest req) {
        if (!adminAiService.isConfigured()) {
            return ResponseEntity.status(503).body(Map.of("error", "AI service not configured"));
        }
        Map<String, Object> result = adminAiService.describeItem(req.name(), req.price(), req.category());
        return ResponseEntity.ok(result);
    }

    /** POST /api/admin/ai/review-digest — weekly sentiment summary of customer reviews */
    @PostMapping("/review-digest")
    public ResponseEntity<Map<String, Object>> reviewDigest(
            @RequestBody(required = false) Map<String, String> body) {
        if (!adminAiService.isConfigured()) {
            return ResponseEntity.status(503).body(Map.of("error", "AI service not configured"));
        }
        UUID tenantId = TenantContext.getCurrentTenantId();
        LocalDate since = null;
        if (body != null && body.containsKey("since")) {
            try {
                since = LocalDate.parse(body.get("since"));
            } catch (Exception ignored) {}
        }
        Map<String, Object> result = adminAiService.reviewDigest(tenantId, since);
        return ResponseEntity.ok(result);
    }
}
