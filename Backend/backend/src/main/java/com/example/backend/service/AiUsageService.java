package com.example.backend.service;

import com.example.backend.repository.TenantAiUsageRepository;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

/**
 * Records per-tenant AI usage + estimated cost on every LLM call. Cost rates are rough
 * (a single blended estimate covering Haiku + the Sonnet copilot) — the RELATIVE cost per
 * tenant is what matters ("who is expensive"), and tokens are exact. Tracking must never
 * break an AI feature, so all failures are swallowed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiUsageService {

    private static final ZoneId SAST = ZoneId.of("Africa/Johannesburg");

    private final TenantAiUsageRepository repo;

    @Value("${anthropic.cost-per-1k-input-rand:0.03}")
    private double inputRatePer1k;

    @Value("${anthropic.cost-per-1k-output-rand:0.15}")
    private double outputRatePer1k;

    /** Record one LLM call against the current tenant. No-op if there's no tenant context. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String feature, long inputTokens, long outputTokens) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return; // platform/system call with no tenant — nothing to attribute
        try {
            long total = Math.max(0, inputTokens) + Math.max(0, outputTokens);
            double cost = (Math.max(0, inputTokens) / 1000.0) * inputRatePer1k
                        + (Math.max(0, outputTokens) / 1000.0) * outputRatePer1k;
            String ym = LocalDate.now(SAST).toString().substring(0, 7); // "YYYY-MM"
            repo.recordUsage(tenantId, ym, feature != null ? feature : "OTHER", total, cost);
        } catch (Exception e) {
            log.warn("AI usage tracking failed (non-fatal): {}", e.getMessage());
        }
    }
}
