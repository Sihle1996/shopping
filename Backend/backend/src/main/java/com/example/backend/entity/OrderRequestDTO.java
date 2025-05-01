package com.example.backend.entity;

import lombok.Data;

import java.util.List;


@Data
public class OrderRequestDTO {
    private List<OrderItemDTO> items;
    private double total;
    private String paymentId;
    private String payerId;
    private String status;
    private String deliveryAddress;
}