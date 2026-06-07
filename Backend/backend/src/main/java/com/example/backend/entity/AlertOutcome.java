package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * The memory for alert calibration: when an alert's one-tap fix is applied, we
 * snapshot what it PREDICTED (revenue/net at risk) and a BASELINE for its subject
 * item, so later we can measure what actually happened versus what we forecast.
 *
 * The measured delta is OBSERVATIONAL — the item's sales rate after the fix vs its
 * prior rate — not proof the alert/action caused the change. It calibrates the
 * predictions over time; it never claims causation.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "alert_outcome")
public class AlertOutcome {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "alert_key")
    private String alertKey;

    /** The alert family (key prefix, e.g. "soldout", "below-cost", "sales-dip"). */
    @Column(name = "alert_type")
    private String alertType;

    /** Subject item, when the fix targets one (nullable for store-level alerts). */
    @Column(name = "item_id")
    private UUID itemId;

    @Column(name = "predicted_revenue_at_risk")
    private Double predictedRevenueAtRisk;

    @Column(name = "predicted_net_at_risk")
    private Double predictedNetAtRisk;

    /** The subject item's ordered units over the 30 days BEFORE the fix (the baseline rate). */
    @Column(name = "baseline_units30d")
    private Integer baselineUnits30d;

    @CreationTimestamp
    @Column(name = "applied_at")
    private LocalDateTime appliedAt;
}
