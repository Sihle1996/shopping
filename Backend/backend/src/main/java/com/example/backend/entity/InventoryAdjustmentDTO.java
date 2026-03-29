package com.example.backend.entity;

import lombok.Data;

import java.util.UUID;

@Data
public class InventoryAdjustmentDTO {
    private UUID menuItemId;
    private int stockChange;
    private int reservedChange;
    private Integer lowStockThreshold; // null = don't change
}
