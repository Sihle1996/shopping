package com.example.backend.entity;

import com.example.backend.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * A running per-driver ledger (mirror of {@link PayoutLedgerEntry}, keyed on the driver instead of
 * the tenant) so driver pay is a real accruing balance, not a recomputed display number.
 * entry_type: EARNING (base pay) | TIP (customer tip) | PAYOUT (settlement debit).
 */
@Data
@Entity
@Table(name = "driver_ledger")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DriverLedgerEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id", nullable = false)
    private User driver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @Column(name = "entry_type", nullable = false)
    private String entryType;

    @Column(name = "amount_rand", nullable = false)
    private BigDecimal amountRand;

    @Column(name = "balance_after", nullable = false)
    private BigDecimal balanceAfter;

    private String description;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
