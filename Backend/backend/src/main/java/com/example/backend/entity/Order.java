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
    @JoinColumn(name = "user_id", nullable = true)
    @JsonBackReference
    private User user;

    private String guestEmail;
    private String guestPhone;

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

    /** Why the order was cancelled, e.g. AUTO_TIMEOUT — null for active/non-cancelled orders. */
    @Column(name = "cancellation_reason", length = 50)
    private String cancellationReason;

    /** How delivery was confirmed: DRIVER_OTP | DRIVER | ADMIN_OVERRIDE — null until delivered. */
    @Column(name = "delivered_by", length = 20)
    private String deliveredBy;

    /** When the order was dispatched (Out for Delivery) — start of the driver leg. */
    @Column(name = "out_for_delivery_at")
    private Instant outForDeliveryAt;

    /** Originating group cart (if this order came from a shared/group cart) + capture-only signals. */
    @Column(name = "group_cart_id")
    private UUID groupCartId;
    @Column(name = "is_group_order", nullable = false)
    private boolean groupOrder = false;
    @Column(name = "group_participant_count")
    private Integer groupParticipantCount;

    private String deliveryAddress;

    private String paymentId;
    private String payerId;

    private Double platformFee;
    private Double deliveryFee;
    private Double discountAmount;
    private String promoCode;
    private Integer loyaltyPointsRedeemed;
    private Double deliveryLat;
    private Double deliveryLon;

    @Column(columnDefinition = "TEXT")
    private String orderNotes;

    private String deliveryOtp;
    private Instant otpExpiresAt;
    private boolean otpVerified;

    private Instant scheduledDeliveryTime;
    private Instant deliveredAt;

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
