package com.example.backend.entity;

import com.example.backend.user.User;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Entity
@NoArgsConstructor
@Table(name = "support_tickets")
public class SupportTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    private UUID orderId;

    @Column(nullable = false)
    private String subject;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketStatus status = TicketStatus.OPEN;

    @Column(columnDefinition = "TEXT")
    private String adminNotes;

    private Instant createdAt = Instant.now();
    private Instant resolvedAt;

    // Customer escalation to the platform (CraveIt). When a store mishandles or doesn't resolve a complaint,
    // the customer can escalate; escalated tickets become visible to the superadmin for oversight so a store
    // can't quietly mistreat customers (which reflects on CraveIt's reputation).
    @Column(nullable = false)
    private boolean escalated = false;
    private Instant escalatedAt;
    @Column(columnDefinition = "TEXT")
    private String escalationReason;

    // Tier-3 store->platform support: audience STORE = customer->store (default), PLATFORM = store->CraveIt.
    // platformNote / platformReviewedAt = the superadmin's response + when they acted (on an escalation or a
    // store request) — gives the platform a way to reply, not just observe.
    @Column(nullable = false)
    private String audience = "STORE";
    @Column(columnDefinition = "TEXT")
    private String platformNote;
    private Instant platformReviewedAt;

    public enum TicketStatus {
        OPEN, IN_PROGRESS, RESOLVED, CLOSED
    }
}
