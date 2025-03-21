package com.example.backend.entity;


import com.example.backend.user.User;
import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "orders")
@NoArgsConstructor
@AllArgsConstructor
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<OrderItem> orderItems = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonBackReference
    private User user;

    private Double totalAmount;
    private Instant orderDate;
    private String status;
    private String deliveryAddress; // Added delivery address field

    private String paymentId;
    private String payerId;

    public Order(User user, List<OrderItem> orderItems, Double totalAmount, Instant orderDate, String status, String deliveryAddress) {
        this.user = user;
        this.totalAmount = totalAmount;
        this.orderDate = orderDate;
        this.status = status;
        this.deliveryAddress = deliveryAddress;
        this.orderItems = orderItems;

        for (OrderItem item : orderItems) {
            item.setOrder(this); // Establish bi-directional relationship
        }
    }
}
