package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Entity
@NoArgsConstructor
@Table(name = "payouts")
public class Payout {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    private Tenant tenant;

    private Instant periodStart;
    private Instant periodEnd;

    private double grossRevenue;
    private double platformFeePercent;
    private double platformFee;
    private double netAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PayoutStatus status = PayoutStatus.PENDING;

    private Instant createdAt = Instant.now();
    private Instant paidAt;

    private String reference;

    @Column(columnDefinition = "TEXT")
    private String notes;

    public enum PayoutStatus {
        PENDING, PAID, ON_HOLD
    }
}
