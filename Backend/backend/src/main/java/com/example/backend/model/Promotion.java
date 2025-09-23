package com.example.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "promotions")
public class Promotion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String description;

    private String imageUrl;

    private String badgeText;

    // Percentage 0-100 (e.g., 15 = 15% off)
    @Column(precision = 10, scale = 2)
    private BigDecimal discountPercent;

    // Scheduling
    @Column(nullable = false)
    private OffsetDateTime startAt;

    @Column(nullable = false)
    private OffsetDateTime endAt;

    // Applicability
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AppliesTo appliesTo; // ALL, CATEGORY, PRODUCT

    private Long targetCategoryId;
    private Long targetProductId;

    // Optional promo code (for checkout) – if null, applies automatically
    private String code;

    // Flags
    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false)
    private boolean featured;

    public enum AppliesTo {
        ALL,
        CATEGORY,
        PRODUCT
    }
}
