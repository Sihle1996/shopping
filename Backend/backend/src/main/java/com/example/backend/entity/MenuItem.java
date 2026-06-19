package com.example.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "menu_items")
public class MenuItem {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NotBlank
    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    @DecimalMin(value = "0.0", inclusive = false, message = "Price must be > 0")
    @Column(name = "price")
    private Double price;

    /**
     * What this item costs the store to make (food/ingredient cost), in Rand.
     * Optional — when null, CraveIt Books estimates it at a benchmark % of price.
     * Drives accurate profit & margin so the AI can advise on pricing/promos.
     */
    @DecimalMin(value = "0.0", message = "Cost cannot be negative")
    @Column(name = "cost")
    @com.fasterxml.jackson.annotation.JsonView(Views.Internal.class)
    private Double cost;

    @Column(name = "is_available", nullable = false)
    private Boolean isAvailable = true;

    @Column(name = "image")
    private String image;

    @Column(name = "category", nullable = false)
    private String category;

    @Min(0)
    @Column(name = "stock", nullable = false)
    @com.fasterxml.jackson.annotation.JsonView(Views.Internal.class)
    private int stock = 0;

    @Min(0)
    @Column(name = "reserved_stock", nullable = false)
    @com.fasterxml.jackson.annotation.JsonView(Views.Internal.class)
    private int reservedStock = 0;

    @Min(0)
    @Column(name = "low_stock_threshold", nullable = false)
    @com.fasterxml.jackson.annotation.JsonView(Views.Internal.class)
    private int lowStockThreshold = 5;

    @Transient
    private int quantity = 1;

    /**
     * Computed (not stored): gross margin % = (price − cost) / price × 100.
     * Returns null when price or cost is unknown (so the UI shows "—", not 0%).
     */
    @Transient
    public Double getMarginPercent() {
        if (price == null || price <= 0 || cost == null) return null;
        return (price - cost) / price * 100.0;
    }

    /** Computed (not stored): no free stock left to sell after reservations. */
    @Transient
    public boolean isSoldOut() {
        return stock >= 0 && (stock - reservedStock) <= 0;
    }

    /** Computed (not stored): units actually sellable now (total minus reserved). */
    @Transient
    public int getAvailableStock() {
        return stock < 0 ? stock : Math.max(0, stock - reservedStock);
    }

    /** Server-side price modifier (ZAR) for a selected option, matched by group name + choice label.
     *  Returns the store's REAL value (may be negative — e.g. a "no cheese" removal); 0 when the option
     *  isn't found, so a client can't fabricate an extra. Lets order/group-cart pricing re-derive the
     *  true extra price instead of trusting the client's submitted number. */
    public double modifierFor(String groupName, String choiceLabel) {
        if (optionGroups == null || groupName == null || choiceLabel == null) return 0.0;
        for (MenuItemOptionGroup g : optionGroups) {
            if (!groupName.equalsIgnoreCase(g.getName()) || g.getChoices() == null) continue;
            for (MenuItemOptionChoice c : g.getChoices()) {
                if (choiceLabel.equalsIgnoreCase(c.getLabel())) {
                    return c.getPriceModifier() != null ? c.getPriceModifier() : 0.0;
                }
            }
        }
        return 0.0;
    }

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    @JsonIgnore
    private Tenant tenant;

    @OneToMany(mappedBy = "menuItem", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    @ToString.Exclude
    private List<CartItem> cartItems = new ArrayList<>();

    @OneToMany(mappedBy = "menuItem", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("sortOrder ASC")
    @ToString.Exclude
    private List<MenuItemOptionGroup> optionGroups = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Version
    private Long version;
}
