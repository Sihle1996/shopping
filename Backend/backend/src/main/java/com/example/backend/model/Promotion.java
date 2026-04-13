package com.example.backend.model;

import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Tenant;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "promotions")
public class Promotion {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String description;

    private String imageUrl;
    private String badgeText;

    @Column(precision = 10, scale = 2)
    private BigDecimal discountPercent;

    @Column(nullable = false)
    private OffsetDateTime startAt;

    @Column(nullable = false)
    private OffsetDateTime endAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AppliesTo appliesTo;

    private UUID targetCategoryId;
    private UUID targetProductId;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "promotion_products",
        joinColumns = @JoinColumn(name = "promotion_id"),
        inverseJoinColumns = @JoinColumn(name = "product_id")
    )
    private List<MenuItem> targetProducts = new ArrayList<>();

    private String code;

    /** Populated at query time — not stored in DB */
    @Transient
    private String targetCategoryName;

    @Transient
    private String targetProductName;

    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false)
    private boolean featured;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    private Tenant tenant;

    public enum AppliesTo {
        ALL,
        CATEGORY,
        PRODUCT,
        MULTI_PRODUCT
    }
}
