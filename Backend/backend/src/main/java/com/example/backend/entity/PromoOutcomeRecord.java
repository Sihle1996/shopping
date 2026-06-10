package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One persisted result of a finished PRODUCT promotion — the memory that lets
 * future suggestions learn from history instead of guessing from margin alone.
 *
 * Stores the measured net lift (item rate change minus the store-wide trend)
 * for one promo on one product. Aggregated per product into average net lift +
 * sample count, which nudges the suggestion ranking. The value is OBSERVED, not
 * a controlled/causal result — so it informs ranking but never claims proof.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "promo_outcome_record")
public class PromoOutcomeRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "product_id")
    private UUID productId;

    /** Promo scope this result came from: PRODUCT (per-item unit lift), ALL (AOV lift), or
     *  MULTI_PRODUCT (avg unit lift across the set). Lets non-product deals self-measure too.
     *  PRODUCT rows carry productId; ALL/MULTI_PRODUCT rows have productId null + this tag. */
    @Column(name = "scope", nullable = false)
    @ColumnDefault("'PRODUCT'")
    private String scope = "PRODUCT";

    /** The promotion this result came from — UNIQUE so each promo is recorded once. */
    @Column(name = "promo_id", unique = true)
    private UUID promoId;

    /** Item rate change during the promo MINUS the store-wide trend (percentage points). */
    @Column(name = "net_lift_percent")
    private Integer netLiftPercent;

    /** Ordered units of the item during the promo — the weight/quality of this sample. */
    @Column(name = "sample_units")
    private Integer sampleUnits;

    @CreationTimestamp
    @Column(name = "recorded_at")
    private LocalDateTime recordedAt;
}
