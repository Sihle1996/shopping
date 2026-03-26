package com.example.backend.entity;

import lombok.Data;

import java.util.UUID;

@Data
public class OrderItemDTO {
    private UUID productId;
    private String name;
    private double price;
    private int quantity;
    private String size;
}
