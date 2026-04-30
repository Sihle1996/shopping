package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "item_tags", uniqueConstraints = @UniqueConstraint(columnNames = {"menu_item_id", "tag"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItemTag {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id", nullable = false)
    private MenuItem menuItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false, length = 64)
    private String tag;
}
