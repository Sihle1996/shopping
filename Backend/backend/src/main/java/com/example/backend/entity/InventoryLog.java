package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "inventory_logs")
public class InventoryLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "menu_item_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private MenuItem menuItem;

    /** Snapshot of the item name at log time — preserved even if the item is later deleted. */
    @Column(name = "menu_item_name_snapshot")
    private String menuItemNameSnapshot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    private Tenant tenant;

    private int stockChange;
    private int reservedChange;
    private String type;

    @CreationTimestamp
    private LocalDateTime timestamp;
}
