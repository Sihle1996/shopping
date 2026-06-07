package com.example.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A proactive "Smart Alert" the AI raised for a store — surfaced in the admin
 * bell. May carry a one-tap action (the same shape as a copilot proposal).
 */
@Entity
@Table(name = "ai_alert")
@Data
@NoArgsConstructor
public class AiAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    @JsonIgnore
    private Tenant tenant;

    /** Stable key for de-duplication (e.g. "soldout:<itemId>", "promo-drought"). */
    @Column(name = "alert_key", nullable = false, length = 120)
    private String alertKey;

    @Column(nullable = false, length = 20)
    private String severity; // high | medium | info

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String body;

    /** Optional one-tap action as JSON: {"action","label","params"}. */
    @Column(columnDefinition = "text")
    private String action;

    /**
     * Optional quantified money impact as JSON:
     * {"revenueAtRisk","grossProfitAtRisk","netProfitAtRisk","timeWindow","label"}.
     * Lets the bell show "R420 at risk" so the owner can triage by money.
     */
    @Column(columnDefinition = "text")
    private String impact;

    @Column(nullable = false, length = 20)
    private String status = "NEW"; // NEW | DONE | DISMISSED

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
