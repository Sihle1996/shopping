package com.example.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A running cost the store owner records in CraveIt Books (rent, staff,
 * packaging, utilities…). Subtracted from net profit to give the true
 * operating profit. Recurring expenses are entered once as a monthly amount
 * and prorated to the reporting window.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "expenses")
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank
    @Column(name = "label", nullable = false)
    private String label;

    /** Free-form category (Rent, Staff, Packaging, Utilities, Marketing, Other…). */
    @Column(name = "category")
    private String category;

    @DecimalMin(value = "0.0", inclusive = false, message = "Amount must be > 0")
    @Column(name = "amount", nullable = false)
    private Double amount;

    /** When true the amount is a MONTHLY recurring cost (prorated to the window). */
    @Column(name = "recurring", nullable = false)
    private boolean recurring = false;

    /** Date the (one-off) cost was incurred. For recurring costs this is the start date. */
    @Column(name = "incurred_on", nullable = false)
    private LocalDate incurredOn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    @JsonIgnore
    private Tenant tenant;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
