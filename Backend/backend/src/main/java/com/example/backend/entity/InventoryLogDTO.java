package com.example.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryLogDTO {
    private Long id;
    private Long menuItemId;
    private String menuItemName;
    private int stockChange;
    private int reservedChange;
    private String type;
    private LocalDateTime timestamp;
}
