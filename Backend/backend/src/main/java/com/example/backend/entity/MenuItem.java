package com.example.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "menu_items")
public class MenuItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    // Consider BigDecimal for money in production.
    @DecimalMin(value = "0.0", inclusive = false, message = "Price must be > 0")
    @Column(name = "price")
    private Double price;

    @Column(name = "is_available", nullable = false)
    private Boolean isAvailable = true;

    @Column(name = "image")
    private String image;

    @Column(name = "category", nullable = false)
    private String category;

    @Min(0)
    @Column(name = "stock", nullable = false)
    private int stock = 0;

    @Min(0)
    @Column(name = "reserved_stock", nullable = false)
    private int reservedStock = 0;

    @Min(0)
    @Column(name = "low_stock_threshold", nullable = false)
    private int lowStockThreshold = 5; // match DB default you added

    @Transient
    private int quantity = 1; // frontend only

    @OneToMany(mappedBy = "menuItem", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    @ToString.Exclude // avoid recursion in logs
    private List<CartItem> cartItems = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
