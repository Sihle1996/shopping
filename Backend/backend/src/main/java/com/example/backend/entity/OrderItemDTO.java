package com.example.backend.entity;

import lombok.Data;

@Data
public class OrderItemDTO {
    private Long productId;
    private String name;
    private double price;
    private int quantity;
    private String size;
}
