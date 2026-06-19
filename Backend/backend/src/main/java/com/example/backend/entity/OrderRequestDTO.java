package com.example.backend.entity;

import jakarta.validation.constraints.Size;
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
    @Size(max = 500, message = "Order notes must be 500 characters or fewer")
    private String orderNotes;
    private String guestEmail;
    private String guestPhone;
    private Double deliveryFee;
    private String scheduledDeliveryTime;
    private String groupCartToken; // set when this order originates from a group cart
}