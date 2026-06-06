package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
@Entity
@Table(name = "payout_ledger")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PayoutLedgerEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

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
