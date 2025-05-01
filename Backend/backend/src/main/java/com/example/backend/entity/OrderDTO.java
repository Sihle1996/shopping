package com.example.backend.entity;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Data
@AllArgsConstructor
public class OrderDTO {
    private Long id;
    private Double totalAmount;
    private String status;
    private String orderDate;
    private String deliveryAddress;
    private Long userId;
    private String userEmail;
    private String paymentId;
    private String payerId;
    private List<OrderItemDTO> items;
    private String driverName; // ✅ NEW FIELD

    public OrderDTO(Long id, Double totalAmount, String status, Instant orderDate,
                    String deliveryAddress, Long userId, String userEmail) {
        this.id = id;
        this.totalAmount = BigDecimal.valueOf(totalAmount).setScale(2, RoundingMode.HALF_UP).doubleValue();
        this.status = status;
        this.deliveryAddress = deliveryAddress;
        this.userId = userId;
        this.userEmail = userEmail;

        LocalDateTime sastDateTime = LocalDateTime.ofInstant(orderDate, ZoneId.of("Africa/Johannesburg"));
        this.orderDate = sastDateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }
}
