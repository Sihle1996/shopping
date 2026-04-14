package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Data
@Entity
@Table(name = "store_hours",
       uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "day_of_week"}))
@NoArgsConstructor
@AllArgsConstructor
public class StoreHours {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    /** 1 = Monday … 7 = Sunday (ISO day-of-week) */
    @Column(name = "day_of_week", nullable = false)
    private int dayOfWeek;

    /** HH:mm, e.g. "08:00" */
    @Column(nullable = false)
    private String openTime;

    /** HH:mm, e.g. "22:00" */
    @Column(nullable = false)
    private String closeTime;

    /** When true the store is closed all day regardless of times */
    @Column(nullable = false)
    private boolean closed;
}
