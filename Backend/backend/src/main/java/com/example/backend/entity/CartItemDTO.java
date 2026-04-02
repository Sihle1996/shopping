package com.example.backend.entity;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CartItemDTO {
    private UUID id;
    private UUID menuItemId;
    private String menuItemName;
    private String menuItemCategory;
    private Double menuItemPrice;
    private Integer quantity;
    private Double totalPrice;
    private String image;
    /** JSON string of selected modifier choices for this cart item */
    private String selectedChoicesJson;
    /** Option groups available for this item (for re-displaying selections) */
    private List<MenuItemOptionGroup> optionGroups;
}
