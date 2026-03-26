package com.example.backend.entity;

import lombok.Data;

import java.util.UUID;

@Data
public class CartItemDTO {
    private UUID id;
    private UUID menuItemId;
    private String menuItemName;
    private Double menuItemPrice;
    private Integer quantity;
    private Double totalPrice;
    private String image; // ✅ this field


}
