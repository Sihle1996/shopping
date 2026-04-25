package com.example.backend.entity;

import com.example.backend.user.User;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(name = "group_cart_items")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class GroupCartItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_cart_id", nullable = false)
    @JsonIgnoreProperties({"items", "owner", "tenant", "hibernateLazyInitializer"})
    private GroupCart groupCart;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties({"password", "authorities", "orders", "cartItems", "hibernateLazyInitializer"})
    private User addedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id", nullable = false)
    @JsonIgnoreProperties({"cartItems", "optionGroups", "tenant", "hibernateLazyInitializer"})
    private MenuItem menuItem;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(nullable = false)
    private Double unitPrice;

    @Column(columnDefinition = "TEXT")
    private String selectedChoicesJson;

    @Column(columnDefinition = "TEXT")
    private String itemNotes;

    @CreationTimestamp
    private Instant addedAt;
}
