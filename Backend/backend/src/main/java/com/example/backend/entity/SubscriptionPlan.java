package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "subscription_plans")
public class SubscriptionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private int maxMenuItems;

    @Column(nullable = false)
    private int maxDrivers;

    @Column(nullable = false)
    private int maxPromotions;

    @Column(nullable = false)
    private int maxDeliveryRadiusKm;

    @Column(nullable = false)
    private boolean hasAnalytics;

    @Column(nullable = false)
    private boolean hasCustomBranding;

    @Column(nullable = false)
    private boolean hasInventoryExport;

    // AI intelligence gates (nullable so ddl-auto can add them locally to the seeded plans;
    // null = not included). Promo AI / driver intelligence / review+support AI / API access.
    @Column(name = "has_promo_ai")
    private Boolean hasPromoAi;

    @Column(name = "has_driver_intel")
    private Boolean hasDriverIntel;

    @Column(name = "has_review_ai")
    private Boolean hasReviewAi;

    @Column(name = "has_api_access")
    private Boolean hasApiAccess;

    /** Monthly Copilot prompt quota (metering = margin protection); null = unlimited / fair use. */
    @Column(name = "copilot_monthly_quota")
    private Integer copilotMonthlyQuota;

    @Column(precision = 5, scale = 2)
    private BigDecimal commissionPercent;

    private String features;

    private LocalDateTime createdAt;
}
