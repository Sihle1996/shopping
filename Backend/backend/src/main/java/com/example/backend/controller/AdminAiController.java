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
        AdminAgentService.AgentResult agent = adminAgentService.chat(question);
        if (agent != null && agent.answer() != null && !agent.answer().isBlank()) {
            Map<String, Object> res = new java.util.LinkedHashMap<>();
            res.put("answer", agent.answer());
            res.put("proposedActions", agent.proposedActions());
            res.put("question", question);
            res.put("data", Map.of());
            return ResponseEntity.ok(res);
        }
        return ResponseEntity.ok(adminAiService.queryAnalytics(question, tenantId));
    }

    /** POST /api/admin/ai/act — apply an action the copilot proposed, after the owner confirms. */
    @PostMapping("/act")
    public ResponseEntity<Map<String, Object>> act(@RequestBody Map<String, Object> body) {
        String action = body.get("action") != null ? body.get("action").toString() : "";
        @SuppressWarnings("unchecked")
        Map<String, Object> params = body.get("params") instanceof Map
                ? (Map<String, Object>) body.get("params") : Map.of();
        if (action.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "message", "action is required"));
        }
        return ResponseEntity.ok(adminAgentService.executeAction(action, params));
    }
}
