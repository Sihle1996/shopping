package com.example.backend.entity;

import com.example.backend.user.User;
import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Entity
@Table(name = "orders")
@NoArgsConstructor
@AllArgsConstructor
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<OrderItem> orderItems = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonBackReference
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id")
    @JsonBackReference
    private User driver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    private Tenant tenant;

    private Double totalAmount;
    private Instant orderDate;
    private String status;
    private String deliveryAddress;

    private String paymentId;
    private String payerId;

    private Double platformFee;
    private Double discountAmount;
    private String promoCode;
    private Double deliveryLat;
    private Double deliveryLon;

    public Order(User user, Tenant tenant, List<OrderItem> orderItems, Double totalAmount, Instant orderDate, String status, String deliveryAddress) {
        this.user = user;
        this.tenant = tenant;
        this.totalAmount = totalAmount;
        this.orderDate = orderDate;
        this.status = status;
        this.deliveryAddress = deliveryAddress;
        this.orderItems = orderItems;

        for (OrderItem item : orderItems) {
            item.setOrder(this);
        }
    }
}
