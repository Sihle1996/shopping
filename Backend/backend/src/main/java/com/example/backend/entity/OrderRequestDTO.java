package com.example.backend.entity;

import lombok.Data;

import java.util.List;
import java.util.UUID;


@Data
public class OrderRequestDTO {
    private List<OrderItemDTO> items;
    private double total;
    private String paymentId;
    private String payerId;
    private String status;
    private String deliveryAddress;
    private Double deliveryLat;
    private Double deliveryLon;
    private UUID tenantId;
    private String promoCode;
    private String orderNotes;
    private String guestEmail;
    private String guestPhone;
    private int loyaltyPointsRedeemed;
}