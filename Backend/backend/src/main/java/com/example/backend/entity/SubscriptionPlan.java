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

    @Column(precision = 5, scale = 2)
    private BigDecimal commissionPercent;

    private String features;

    private LocalDateTime createdAt;
}
