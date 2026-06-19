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

    // Set once when the store has been credited in the payout ledger for this order — makes crediting
    // idempotent across the admin and driver delivery paths and under concurrent status updates.
    @Column(name = "payout_credited")
    private Boolean payoutCredited;

    // Set once when a refund has been debited from the store's ledger for this order — makes the
    // refund debit idempotent (mirrors payoutCredited) so a status flip-flop can't double-debit.
    @Column(name = "payout_debited")
    private Boolean payoutDebited;

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

    /** Promo-economics capture (V52) — what lever applied, what the platform waived, who funded it.
     *  All NULL when no promo applied. waivedDeliveryFee is set ONLY for FREE_DELIVERY (never 0.0-for-N/A). */
    @Column(name = "promo_type", length = 20)
    private String promoType;                 // PERCENT_OFF | AMOUNT_OFF | FREE_DELIVERY
    /** Stable id of the applied promotion (V53) — anchors cost attribution against code/title edits. */
    @Column(name = "promo_id")
    private UUID promoId;
    @Column(name = "waived_delivery_fee")
    private Double waivedDeliveryFee;
    @Column(name = "promo_funded_by", length = 16)
    private String promoFundedBy;             // PLATFORM | STORE | (SHARED reserved)
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

    /** True once payment is confirmed (paymentId set by the PayFast ITN) — or there's nothing to
     *  pay (a fully-covered / zero-total order). Used to gate fulfilment and auto-cancel. */
    public boolean isPaid() {
        boolean hasPayment = paymentId != null && !paymentId.isBlank();
        double payable = (totalAmount != null ? totalAmount : 0.0)
                + (deliveryFee != null ? deliveryFee : 0.0);
        return hasPayment || payable <= 0.0;
    }
}
