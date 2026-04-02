package com.example.backend.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Snapshot of a selected modifier choice at the time an order was placed.
 * Stored separately so menu changes don't alter historical orders.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "order_item_choices")
public class OrderItemChoice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id", nullable = false)
    @JsonBackReference
    private OrderItem orderItem;

    /** Group name snapshot (e.g. "Size", "Extras") */
    @Column(nullable = false)
    private String groupName;

    /** Choice label snapshot (e.g. "Large", "Extra Cheese") */
    @Column(nullable = false)
    private String choiceLabel;

    /** Price modifier snapshot at order time */
    @Column(nullable = false)
    private Double priceModifier = 0.0;
}
