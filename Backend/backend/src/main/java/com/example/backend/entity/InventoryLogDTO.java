package com.example.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryLogDTO {
    private UUID id;
    private UUID menuItemId;
    private String menuItemName;
    private int stockChange;
    private int reservedChange;
    private String type;
    private LocalDateTime timestamp;
}
