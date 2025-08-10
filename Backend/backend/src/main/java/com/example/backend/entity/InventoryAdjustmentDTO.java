package com.example.backend.entity;

import lombok.Data;

@Data
public class InventoryAdjustmentDTO {
    private Long menuItemId;
    private int stockChange;
    private int reservedChange;
}
