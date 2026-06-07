package com.example.backend.controller;

import com.example.backend.dto.AiDescribeItemRequest;
import com.example.backend.service.AdminAiService;
import com.example.backend.service.AdminAgentService;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

// All endpoints require ADMIN role (set at class level)

@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAiController {

    private final AdminAiService adminAiService;
    private final AdminAgentService adminAgentService;

    /** POST /api/admin/ai/describe-item — generate description + tags for a menu item */
    @PostMapping("/describe-item")
    public ResponseEntity<Map<String, Object>> describeItem(@RequestBody AiDescribeItemRequest req) {
        Map<String, Object> result = adminAiService.describeItem(req.name(), req.price(), req.category());
        return ResponseEntity.ok(result);
    }

    /** POST /api/admin/ai/review-digest — weekly sentiment summary of customer reviews */
    @PostMapping("/review-digest")
    public ResponseEntity<Map<String, Object>> reviewDigest(
            @RequestBody(required = false) Map<String, String> body) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        LocalDate since = null;
        if (body != null && body.containsKey("since")) {
            try {
                since = LocalDate.parse(body.get("since"));
            } catch (Exception ignored) {}
        }
        return ResponseEntity.ok(adminAiService.reviewDigest(tenantId, since));
    }

    /** POST /api/admin/ai/suggest-promotions — AI-generated promotion suggestions */
    @PostMapping("/suggest-promotions")
    public ResponseEntity<Map<String, Object>> suggestPromotions() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        return ResponseEntity.ok(adminAiService.suggestPromotions(tenantId));
    }

    /** POST /api/admin/ai/query — conversational analytics */
    @PostMapping("/query")
    public ResponseEntity<Map<String, Object>> query(
            @RequestBody Map<String, String> body) {
        String question = body.getOrDefault("question", "").trim();
        if (question.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "question is required"));
        }
        UUID tenantId = TenantContext.getCurrentTenantId();
        // Prefer the agentic copilot (tool use); fall back to the rule-based path
        // when AI isn't configured or the agent can't answer.
        String answer = adminAgentService.chat(question);
        if (answer != null && !answer.isBlank()) {
            Map<String, Object> res = new java.util.LinkedHashMap<>();
            res.put("answer", answer);
            res.put("question", question);
            res.put("data", Map.of());
            return ResponseEntity.ok(res);
        }
        return ResponseEntity.ok(adminAiService.queryAnalytics(question, tenantId));
    }
}
