package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * A unified, human-readable activity trail: who did what, to which entity, when. Complements the
 * machine logs (inventory_logs, ai_action_log) with a single timeline an owner can actually read —
 * order moves, driver assignments, deliveries, auto-cancels, and AI-alert actions.
 */
@Entity
@Table(name = "audit_event", indexes = {
        @Index(name = "idx_audit_tenant_created", columnList = "tenant_id, created_at"),
        @Index(name = "idx_audit_entity", columnList = "entity_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    /** Who acted — null for SYSTEM/scheduled events. */
    @Column(name = "actor_email")
    private String actorEmail;
    @Column(name = "actor_role")
    private String actorRole;

    /** Where the action originated: ADMIN | DRIVER | AI | SYSTEM. */
    @Column(nullable = false, length = 16)
    private String source;

    /** Machine-stable action key, e.g. ORDER_STATUS_CHANGED, DRIVER_ASSIGNED, ALERT_APPLIED. */
    @Column(nullable = false, length = 40)
    private String action;

    /** What kind of thing was affected: ORDER | ALERT | PROMOTION | MENU_ITEM | TENANT | DRIVER. */
    @Column(name = "entity_type", length = 24)
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    /** Human-readable one-liner, e.g. "Preparing → Out for Delivery" or "Assigned John Dube". */
    @Column(length = 500)
    private String summary;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
