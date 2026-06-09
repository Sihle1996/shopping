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

    private Promotion.PromoType type; // PERCENT_OFF (default), AMOUNT_OFF, FREE_DELIVERY

    @DecimalMin(value = "0.0")
    private BigDecimal minSpend;       // qualifying threshold (null = no minimum)

    @DecimalMin(value = "0.0")
    private BigDecimal discountAmount; // fixed rand off, for AMOUNT_OFF

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
