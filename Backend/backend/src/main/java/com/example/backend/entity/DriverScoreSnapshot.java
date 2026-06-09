package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A daily point-in-time copy of a driver's on-time score. We only keep one live EWMA value per
 * driver; this history table lets future features show real trends ("78% -> 92% over 30 days")
 * instead of inventing them. Captured by a scheduled job; never blocks anything.
 */
@Entity
@Table(name = "driver_score_snapshot", uniqueConstraints = {
        @UniqueConstraint(name = "ux_driver_snapshot_day", columnNames = {"driver_id", "snapshot_date"})
}, indexes = {
        @Index(name = "idx_driver_snapshot_tenant", columnList = "tenant_id, snapshot_date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DriverScoreSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "driver_id", nullable = false)
    private UUID driverId;

    /** On-time % (the EWMA * 100) at snapshot time. */
    @Column(name = "on_time_rate")
    private Integer onTimeRate;

    private Integer samples;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "created_at")
    private Instant createdAt;
}
