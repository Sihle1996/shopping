package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;
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

    /** Storefront hero/cover image (Cloudinary URL) — the store page's banner. */
    private String coverImageUrl;

    /** Short storefront description / tagline shown under the store name. */
    @Column(columnDefinition = "TEXT")
    private String storeDescription;

    /** Social links (full URLs); blank/null = hidden on the storefront. */
    private String instagramUrl;
    private String facebookUrl;
    private String websiteUrl;

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

    /** FALLBACK commission rate per plan (the agreed tiering): STARTER 6% · BASIC 4% · PRO 3% ·
     *  ENTERPRISE 2%. PlanCommissionService reads the subscription_plans table first and only uses
     *  this when a plan has no row (e.g. STARTER). Unknown/trial → BASIC's 4%. */
    public static BigDecimal commissionForPlan(String plan) {
        if (plan == null) return new BigDecimal("4.00");
        return switch (plan.trim().toUpperCase()) {
            case "STARTER"    -> new BigDecimal("6.00");
            case "PRO"        -> new BigDecimal("3.00");
            case "ENTERPRISE" -> new BigDecimal("2.00");
            default            -> new BigDecimal("4.00"); // BASIC / TRIAL
        };
    }

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

    /** True when an admin (or the AI) manually set isOpen, overriding the weekly hours schedule.
     *  While true, StoreHoursScheduler leaves isOpen alone; it auto open/closes only when this is
     *  false. The override is released once the schedule next agrees with it. */
    @Column(name = "manual_open_override", nullable = false)
    @ColumnDefault("false")
    @Builder.Default
    private Boolean manualOpenOverride = false;

    @Column(precision = 10, scale = 2)
    private BigDecimal minimumOrderAmount;

    @Column(nullable = false)
    @Builder.Default
    private Integer estimatedDeliveryMinutes = 30;

    /** Auto-cancel an unaccepted (Pending) order after this many minutes. 0 = disabled. */
    @Column(name = "auto_cancel_minutes")
    @Builder.Default
    private Integer autoCancelMinutes = 15;

    @Column(length = 500)
    private String openingHours;

    @Column(length = 50)
    private String cuisineType;

    // Share of each delivery fee paid to the driver (store-configurable)
    @Column(precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal driverEarningPercent = new BigDecimal("10.00");

    // Enrollment — structured details (captured via form, not just document uploads)
    @Column(length = 20)
    private String cipcNumber;

    @Column(length = 60)
    private String bankName;

    @Column(length = 30)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private String bankAccountNumber;

    @Column(length = 20)
    private String bankAccountType;  // Cheque / Savings / Current

    @Column(length = 10)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private String bankBranchCode;

    // Banking-change re-review: an APPROVED store proposes new bank details here; the live bank fields
    // above are NOT changed until a Compliance super-admin approves. bankingChangeStatus: null | PENDING.
    private String bankingChangeStatus;
    private String pendingBankName;
    @com.fasterxml.jackson.annotation.JsonIgnore
    private String pendingBankAccountNumber;
    private String pendingBankAccountType;
    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "pending_bank_branch_code", length = 10)
    private String pendingBankBranchCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false)
    @Builder.Default
    // Safe default: a new tenant is unapproved until it submits documents and a SUPERADMIN approves.
    // Creation paths that intentionally bypass review (e.g. admin-created stores) set APPROVED explicitly.
    private ApprovalStatus approvalStatus = ApprovalStatus.DRAFT;

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;

    private Instant submittedForReviewAt;
    private Instant approvedAt;

    @Column(name = "is_archived", nullable = false)
    @Builder.Default
    private boolean archived = false;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum ApprovalStatus {
        DRAFT, PENDING_REVIEW, APPROVED, REJECTED
    }
}
