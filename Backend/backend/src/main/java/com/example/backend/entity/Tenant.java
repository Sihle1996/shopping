package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "tenants")
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String slug;

    private String logoUrl;

    @Column(length = 7)
    private String primaryColor;

    private String phone;
    private String email;

    @Column(columnDefinition = "TEXT")
    private String address;

    private Double latitude;
    private Double longitude;

    @Column(nullable = false)
    @Builder.Default
    private Integer deliveryRadiusKm = 10;

    @Column(precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal deliveryFeeBase = BigDecimal.ZERO;

    @Column(precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal platformCommissionPercent = new BigDecimal("4.00");

    @Column(nullable = false)
    @Builder.Default
    private String subscriptionStatus = "TRIAL";

    @Column(nullable = false)
    @Builder.Default
    private String subscriptionPlan = "BASIC";

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    private LocalDateTime trialStartedAt;
    private LocalDateTime billingPeriodEnd;
    private LocalDateTime subscriptionCancelledAt;
    private String scheduledDowngradePlan;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isOpen = false;

    @Column(precision = 10, scale = 2)
    private BigDecimal minimumOrderAmount;

    @Column(nullable = false)
    @Builder.Default
    private Integer estimatedDeliveryMinutes = 30;

    @Column(length = 500)
    private String openingHours;

    @Column(length = 50)
    private String cuisineType;

    // Enrollment — structured details (captured via form, not just document uploads)
    @Column(length = 20)
    private String cipcNumber;

    @Column(length = 60)
    private String bankName;

    @Column(length = 30)
    private String bankAccountNumber;

    @Column(length = 20)
    private String bankAccountType;  // Cheque / Savings / Current

    @Column(length = 10)
    private String bankBranchCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false, columnDefinition = "varchar(20) default 'APPROVED'")
    @Builder.Default
    private ApprovalStatus approvalStatus = ApprovalStatus.APPROVED;

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;

    private Instant submittedForReviewAt;
    private Instant approvedAt;

    @Column(nullable = false)
    @Builder.Default
    private boolean isArchived = false;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum ApprovalStatus {
        DRAFT, PENDING_REVIEW, APPROVED, REJECTED
    }
}
