package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "combo_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ComboItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "combo_id", nullable = false)
    private Combo combo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id", nullable = false)
    private MenuItem menuItem;

    // MAIN | DRINK | SIDE | DESSERT
    @Column(nullable = false, length = 16)
    @Builder.Default
    private String role = "MAIN";

    @Column(nullable = false)
    @Builder.Default
    private int quantity = 1;
}
