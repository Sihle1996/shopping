package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "intent_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IntentProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // NULL = global default, non-null = tenant override
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    private Tenant tenant;

    @Column(name = "intent_key", nullable = false, length = 32)
    private String intentKey;

    @Column(nullable = false, length = 64)
    private String label;

    @Column(length = 8)
    private String emoji;

    @Column(name = "max_price_rand", precision = 10, scale = 2)
    private BigDecimal maxPriceRand;

    // Stored as comma-separated values, e.g. "filling,comfort"
    @Column(name = "preferred_tags", columnDefinition = "TEXT")
    private String preferredTags;

    @Column(name = "excluded_tags", columnDefinition = "TEXT")
    private String excludedTags;

    @Column(name = "preferred_categories", columnDefinition = "TEXT")
    private String preferredCategories;

    @Column(name = "sort_by", nullable = false, length = 32)
    @Builder.Default
    private String sortBy = "SCORE";

    @Column(name = "boost_promotions", nullable = false)
    @Builder.Default
    private boolean boostPromotions = true;

    public List<String> preferredTagList() {
        return splitCsv(preferredTags);
    }

    public List<String> excludedTagList() {
        return splitCsv(excludedTags);
    }

    public List<String> preferredCategoryList() {
        return splitCsv(preferredCategories);
    }

    private List<String> splitCsv(String csv) {
        if (csv == null || csv.isBlank()) return Collections.emptyList();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
