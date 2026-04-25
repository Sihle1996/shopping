package com.example.backend.entity;

import com.example.backend.user.User;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(name = "group_carts")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class GroupCart {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Column(unique = true, nullable = false, length = 12)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    @JsonIgnoreProperties({"menuItems", "categories", "users", "openingHours", "hibernateLazyInitializer"})
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    @JsonIgnoreProperties({"password", "authorities", "orders", "cartItems", "hibernateLazyInitializer"})
    private User owner;

    @Column(nullable = false, length = 20)
    private String status = "OPEN";

    @OneToMany(mappedBy = "groupCart", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<GroupCartItem> items = new ArrayList<>();

    @CreationTimestamp
    private Instant createdAt;
}
