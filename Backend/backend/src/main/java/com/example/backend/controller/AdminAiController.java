package com.example.backend.controller;

import com.example.backend.dto.AiDescribeItemRequest;
import com.example.backend.entity.AiAlert;
import com.example.backend.repository.AiAlertRepository;
import com.example.backend.service.AdminAiService;
import com.example.backend.service.AdminAgentService;
import com.example.backend.service.AiUsageService;
import com.example.backend.service.AuditService;
import com.example.backend.service.CapabilityRegistry;
import com.example.backend.service.DriverAssignmentService;
import com.example.backend.service.SmartAlertService;
import com.example.backend.service.SubscriptionEnforcementService;
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
    private final CapabilityRegistry capabilityRegistry;
    private final DriverAssignmentService driverAssignmentService;
    private final AuditService auditService;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final AiUsageService aiUsageService;
    private final ObjectMapper objectMapper;

    /** Run a plan gate only when there's a tenant context (mirrors AnalyticsController). */
    private void gate(java.util.function.Consumer<UUID> assertion) {
        UUID t = TenantContext.getCurrentTenantId();
        if (t != null) assertion.accept(t);
    }

    /** GET /api/admin/ai/capabilities — the per-tenant capability manifest (AI + UI share it) */
    @GetMapping("/capabilities")
    public ResponseEntity<?> capabilities(@RequestParam(required = false) String module) {
        return ResponseEntity.ok(capabilityRegistry.describe(TenantContext.getCurrentTenantId(), module));
    }

    /** GET /api/admin/ai/status — whether the LLM features are enabled (Anthropic API key set). The UI uses
     *  this to show a graceful "AI unavailable" message instead of failing silently. */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of("configured", adminAiService.isConfigured()));
    }

    /** POST /api/admin/ai/complete-name — append-only name completion for Smart Fill ghost text */
    @PostMapping("/complete-name")
    public ResponseEntity<Map<String, Object>> completeName(@RequestBody Map<String, String> body) {
        gate(subscriptionEnforcementService::assertCopilotQuota);   // metered like /query
        aiUsageService.record("COPILOT_PROMPT", 0, 0);
        String partial = body.getOrDefault("partial", "");
        String category = body.getOrDefault("category", "");
        return ResponseEntity.ok(adminAiService.completeName(partial, category));
    }

    /** POST /api/admin/ai/describe-item — generate description + tags for a menu item */
    @PostMapping("/describe-item")
    public ResponseEntity<Map<String, Object>> describeItem(@RequestBody AiDescribeItemRequest req) {
        gate(subscriptionEnforcementService::assertCopilotQuota);   // metered like /query
        aiUsageService.record("COPILOT_PROMPT", 0, 0);
        Map<String, Object> result = adminAiService.describeItem(req.name(), req.price(), req.category());
        return ResponseEntity.ok(result);
    }

    /** POST /api/admin/ai/support/draft — draft a reply + triage for a support ticket */
    @PostMapping("/support/draft")
    public ResponseEntity<Map<String, Object>> supportDraft(@RequestBody Map<String, String> body) {
        gate(subscriptionEnforcementService::assertReviewAiAccess);
        String subject = body.getOrDefault("subject", "").trim();
        String message = body.getOrDefault("message", "").trim();
        if (message.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "message is required"));
        }
        UUID orderId = null;
        String oid = body.get("orderId");
        if (oid != null && !oid.isBlank()) {
            try { orderId = UUID.fromString(oid.trim()); } catch (IllegalArgumentException ignored) {}
        }
        return ResponseEntity.ok(adminAiService.draftSupportReply(subject, message, orderId));
    }

    /** GET /api/admin/ai/driver-insights — driver scorecard + performance insights + coverage */
    @GetMapping("/driver-insights")
    public ResponseEntity<Map<String, Object>> driverInsights() {
        gate(subscriptionEnforcementService::assertDriverIntelAccess);
        return ResponseEntity.ok(adminAiService.driverInsights(TenantContext.getCurrentTenantId()));
    }

    /** GET /api/admin/ai/driver-recommendations/{orderId} — ranked, explained driver suggestions
     *  for an order (deterministic; recommend-only — the admin still assigns). */
    @GetMapping("/driver-recommendations/{orderId}")
    public ResponseEntity<Map<String, Object>> driverRecommendations(@PathVariable UUID orderId) {
        return ResponseEntity.ok(
                driverAssignmentService.recommendDrivers(TenantContext.getCurrentTenantId(), orderId));
    }

    /** GET /api/admin/ai/recommendation-stats — is the engine helping? Acceptance rate + outcomes. */
    @GetMapping("/recommendation-stats")
    public ResponseEntity<Map<String, Object>> recommendationStats() {
        gate(subscriptionEnforcementService::assertDriverIntelAccess);
        return ResponseEntity.ok(driverAssignmentService.recommendationStats(TenantContext.getCurrentTenantId()));
    }

    /** GET /api/admin/ai/review-book-insights — opportunities/risks from profit x review sentiment */
    @GetMapping("/review-book-insights")
    public ResponseEntity<Map<String, Object>> reviewBookInsights() {
        gate(subscriptionEnforcementService::assertReviewAiAccess);
        return ResponseEntity.ok(adminAiService.reviewBookInsights(TenantContext.getCurrentTenantId()));
    }

    /** GET /api/admin/ai/plan-advice — does the subscription fit current usage/growth? */
    @GetMapping("/plan-advice")
    public ResponseEntity<Map<String, Object>> planAdvice() {
        return ResponseEntity.ok(adminAiService.planAdvice(TenantContext.getCurrentTenantId()));
    }

    /** POST /api/admin/ai/menu/bulk-describe — fill descriptions for items missing one */
    @PostMapping("/menu/bulk-describe")
    public ResponseEntity<Map<String, Object>> bulkDescribe() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        return ResponseEntity.ok(adminAiService.bulkGenerateDescriptions(tenantId));
    }

    /** POST /api/admin/ai/review/draft-reply — draft a public reply to one review */
    @PostMapping("/review/draft-reply")
    public ResponseEntity<Map<String, Object>> reviewReply(@RequestBody Map<String, Object> body) {
        gate(subscriptionEnforcementService::assertReviewAiAccess);
        int rating = body.get("rating") instanceof Number n ? n.intValue() : 0;
        String comment = body.get("comment") != null ? body.get("comment").toString() : "";
        return ResponseEntity.ok(adminAiService.draftReviewReply(rating, comment));
    }

    /** POST /api/admin/ai/review-digest — weekly sentiment summary of customer reviews */
    @PostMapping("/review-digest")
    public ResponseEntity<Map<String, Object>> reviewDigest(
            @RequestBody(required = false) Map<String, String> body) {
        gate(subscriptionEnforcementService::assertReviewAiAccess);
        UUID tenantId = TenantContext.getCurrentTenantId();
        LocalDate since = null;
        if (body != null && body.containsKey("since")) {
            try {
                since = LocalDate.parse(body.get("since"));
            } catch (Exception ignored) {}
        }
        return ResponseEntity.ok(adminAiService.reviewDigest(tenantId, since));
    }

    /** GET /api/admin/ai/alert-outcomes — calibration: each applied alert fix, predicted vs observed */
    @GetMapping("/alert-outcomes")
    public ResponseEntity<Map<String, Object>> alertOutcomes() {
        return ResponseEntity.ok(adminAiService.alertOutcomes(TenantContext.getCurrentTenantId()));
    }

    /** GET /api/admin/ai/promo-outcomes — measured before-vs-during results per product promo */
    @GetMapping("/promo-outcomes")
    public ResponseEntity<Map<String, Object>> promoOutcomes() {
        gate(subscriptionEnforcementService::assertPromoAiAccess);
        return ResponseEntity.ok(adminAiService.promoOutcomes(TenantContext.getCurrentTenantId()));
    }

    /** POST /api/admin/ai/suggest-promotions — AI-generated promotion suggestions */
    @PostMapping("/suggest-promotions")
    public ResponseEntity<Map<String, Object>> suggestPromotions() {
        gate(subscriptionEnforcementService::assertPromoAiAccess);
        UUID tenantId = TenantContext.getCurrentTenantId();
        return ResponseEntity.ok(adminAiService.suggestPromotions(tenantId));
    }

    /** POST /api/admin/ai/query — conversational analytics */
    @PostMapping("/query")
    public ResponseEntity<Map<String, Object>> query(
            @RequestBody Map<String, Object> body) {
        String question = body.get("question") != null ? body.get("question").toString().trim() : "";
        if (question.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "question is required"));
        }
        gate(subscriptionEnforcementService::assertCopilotQuota);   // Copilot is metered, not blocked
        aiUsageService.record("COPILOT_PROMPT", 0, 0);              // 1 per user query, toward the quota
        UUID tenantId = TenantContext.getCurrentTenantId();
        java.util.List<?> history = body.get("history") instanceof java.util.List<?> h ? h : null;
        // Prefer the agentic copilot (tool use); fall back to the rule-based path
        // when AI isn't configured or the agent can't answer.
        AdminAgentService.AgentResult agent = adminAgentService.chat(question, history);
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

    /** GET /api/admin/ai/promo-economics — deterministic last-7-days ALL-scope promo net-lift for the
     *  briefing panel (reporting-only; separate from the LLM briefing so it can't be editorialised). */
    @GetMapping("/promo-economics")
    public ResponseEntity<Map<String, Object>> promoEconomics() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.ok(Map.of("promos", java.util.List.of()));
        subscriptionEnforcementService.assertPromoAiAccess(tenantId);
        return ResponseEntity.ok(adminAiService.promoEconomics7d(tenantId));
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
            if (Boolean.TRUE.equals(result.get("ok"))) {
                a.setStatus("DONE");
                aiAlertRepository.save(a);
                auditService.log(AuditService.AI, "ALERT_APPLIED", "ALERT", a.getId(), "Applied: " + a.getTitle());
                // CALIBRATION: remember what this fix predicted + the item baseline, to measure later.
                try { adminAiService.recordAlertApplied(tenantId, a.getAlertKey(), a.getImpact(), a.getAction()); }
                catch (Exception ignored) {}
            }
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
            auditService.log(AuditService.AI, "ALERT_DISMISSED", "ALERT", a.getId(), "Dismissed: " + a.getTitle());
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
        Object impact = null;
        if (a.getImpact() != null) {
            try { impact = objectMapper.readValue(a.getImpact(), Map.class); } catch (Exception ignored) {}
        }
        m.put("impact", impact);
        return m;
    }
}
