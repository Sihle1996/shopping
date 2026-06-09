package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * One row per order's driver assignment: what the engine recommended vs what the admin chose, and
 * (filled on delivery) how that choice actually turned out. Turns "I think this is a good pick"
 * into "I can measure whether following the recommendation produces better deliveries."
 */
@Entity
@Table(name = "recommendation_decision", indexes = {
        @Index(name = "idx_recdec_tenant", columnList = "tenant_id"),
        @Index(name = "idx_recdec_order", columnList = "order_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecommendationDecision {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    /** Top recommended driver shown to the admin (null if no recommendation was displayed). */
    @Column(name = "recommended_driver_id")
    private UUID recommendedDriverId;
    @Column(name = "recommendation_score")
    private Double recommendationScore;

    @Column(name = "assigned_driver_id")
    private UUID assignedDriverId;

    /** assigned == recommended (only meaningful when a recommendation was shown). */
    private boolean accepted;

    /** Filled when the order is delivered — the driver-leg minutes and whether it was on time. */
    @Column(name = "driver_leg_minutes")
    private Integer driverLegMinutes;
    @Column(name = "on_time")
    private Boolean onTime;

    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "delivered_at")
    private Instant deliveredAt;
}
