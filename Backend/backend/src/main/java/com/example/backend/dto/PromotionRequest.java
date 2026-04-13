package com.example.backend.dto;

import com.example.backend.model.Promotion;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class PromotionRequest {
    @NotBlank
    private String title;

    private String description;
    private String imageUrl;
    private String badgeText;

    @DecimalMin(value = "0.0")
    @DecimalMax(value = "100.0")
    private BigDecimal discountPercent;

    @NotNull
    private OffsetDateTime startAt;

    @NotNull
    private OffsetDateTime endAt;

    @NotNull
    private Promotion.AppliesTo appliesTo; // ALL, CATEGORY, PRODUCT, MULTI_PRODUCT

    private UUID targetCategoryId;
    private UUID targetProductId;
    private List<UUID> targetProductIds;
    private String code;

    private boolean active = true;
    private boolean featured = false;
}
