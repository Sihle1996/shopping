package com.example.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "menu_item_option_choices")
public class MenuItemOptionChoice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "option_group_id", nullable = false)
    @JsonIgnore
    private MenuItemOptionGroup optionGroup;

    @Column(nullable = false)
    private String label;

    /** Extra cost in ZAR. 0 = no extra charge. Can be negative for removals. */
    @Column(nullable = false)
    @Builder.Default
    private Double priceModifier = 0.0;

    @Column(nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;
}
