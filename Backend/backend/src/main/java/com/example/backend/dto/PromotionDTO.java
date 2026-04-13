package com.example.backend.dto;

import com.example.backend.model.Promotion;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class PromotionDTO {
    private UUID id;
    private String title;
    private String description;
    private String imageUrl;
    private String badgeText;
    private BigDecimal discountPercent;
    private String startAt;   // ISO string — avoids OffsetDateTime serialization issues
    private String endAt;
    private String appliesTo;
    private UUID targetCategoryId;
    private String targetCategoryName;
    private UUID targetProductId;
    private String targetProductName;
    private List<ProductRef> targetProducts = new ArrayList<>();
    private String code;
    private boolean active;
    private boolean featured;

    @Data
    public static class ProductRef {
        private UUID id;
        private String name;
    }

    public static PromotionDTO from(Promotion p) {
        PromotionDTO dto = new PromotionDTO();
        dto.setId(p.getId());
        dto.setTitle(p.getTitle());
        dto.setDescription(p.getDescription());
        dto.setImageUrl(p.getImageUrl());
        dto.setBadgeText(p.getBadgeText());
        dto.setDiscountPercent(p.getDiscountPercent());
        dto.setStartAt(p.getStartAt() != null ? p.getStartAt().toString() : null);
        dto.setEndAt(p.getEndAt() != null ? p.getEndAt().toString() : null);
        dto.setAppliesTo(p.getAppliesTo() != null ? p.getAppliesTo().name() : null);
        dto.setTargetCategoryId(p.getTargetCategoryId());
        dto.setTargetCategoryName(p.getTargetCategoryName());
        dto.setTargetProductId(p.getTargetProductId());
        dto.setTargetProductName(p.getTargetProductName());
        dto.setCode(p.getCode());
        dto.setActive(p.isActive());
        dto.setFeatured(p.isFeatured());
        if (p.getTargetProducts() != null) {
            dto.setTargetProducts(p.getTargetProducts().stream().map(m -> {
                ProductRef ref = new ProductRef();
                ref.setId(m.getId());
                ref.setName(m.getName());
                return ref;
            }).toList());
        }
        return dto;
    }
}
