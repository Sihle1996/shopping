package com.example.backend.controller;

import com.example.backend.dto.AiDescribeItemRequest;
import com.example.backend.entity.AiAlert;
import com.example.backend.repository.AiAlertRepository;
import com.example.backend.service.AdminAiService;
import com.example.backend.service.AdminAgentService;
import com.example.backend.service.SmartAlertService;
import com.example.backend.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
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
    private final SmartAlertService smartAlertService;
    private final AiAlertRepository aiAlertRepository;
    private final ObjectMapper objectMapper;

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

    /** GET /api/admin/ai/briefing — a short proactive daily briefing from real store data. */
    @GetMapping("/briefing")
    public ResponseEntity<Map<String, Object>> briefing() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.ok(Map.of("briefing", ""));
        return ResponseEntity.ok(adminAgentService.dailyBriefing(tenantId));
    }

    /** GET /api/admin/ai/alerts — proactive Smart Alerts for the bell (refreshes on load). */
    @GetMapping("/alerts")
    public ResponseEntity<List<Map<String, Object>>> alerts() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.ok(List.of());
        try { smartAlertService.scan(tenantId); } catch (Exception ignored) {}
        List<Map<String, Object>> out = aiAlertRepository
                .findByTenant_IdAndStatusOrderByCreatedAtDesc(tenantId, "NEW")
                .stream().map(this::toAlertDto).toList();
        return ResponseEntity.ok(out);
    }

    /** POST /api/admin/ai/alerts/{id}/apply — run the alert's one-tap action. */
    @PostMapping("/alerts/{id}/apply")
    public ResponseEntity<Map<String, Object>> applyAlert(@PathVariable UUID id) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        AiAlert a = aiAlertRepository.findByIdAndTenant_Id(id, tenantId).orElse(null);
        if (a == null) return ResponseEntity.notFound().build();
        if (a.getAction() == null) return ResponseEntity.badRequest().body(Map.of("ok", false, "message", "No action on this alert"));
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> act = objectMapper.readValue(a.getAction(), Map.class);
            @SuppressWarnings("unchecked")
            Map<String, Object> params = act.get("params") instanceof Map ? (Map<String, Object>) act.get("params") : Map.of();
            Map<String, Object> result = adminAgentService.executeAction((String) act.get("action"), params);
            if (Boolean.TRUE.equals(result.get("ok"))) { a.setStatus("DONE"); aiAlertRepository.save(a); }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("ok", false, "message", "Couldn't apply: " + e.getMessage()));
        }
    }

    /** POST /api/admin/ai/alerts/{id}/dismiss — hide an alert. */
    @PostMapping("/alerts/{id}/dismiss")
    public ResponseEntity<Map<String, Object>> dismissAlert(@PathVariable UUID id) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        aiAlertRepository.findByIdAndTenant_Id(id, tenantId).ifPresent(a -> {
            a.setStatus("DISMISSED");
            aiAlertRepository.save(a);
        });
        return ResponseEntity.ok(Map.of("ok", true));
    }

    private Map<String, Object> toAlertDto(AiAlert a) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("severity", a.getSeverity());
        m.put("title", a.getTitle());
        m.put("body", a.getBody());
        m.put("createdAt", a.getCreatedAt());
        Object action = null;
        if (a.getAction() != null) {
            try { action = objectMapper.readValue(a.getAction(), Map.class); } catch (Exception ignored) {}
        }
        m.put("action", action);
        return m;
    }
}
