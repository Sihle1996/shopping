package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

// One message in a support ticket's conversation thread. Replaces the old single-field replies
// (adminNotes / platformNote) with a real back-and-forth between the customer, the store, and CraveIt.
@Data
@Entity
@NoArgsConstructor
@Table(name = "support_messages")
public class SupportMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id")
    private SupportTicket ticket;

    /** CUSTOMER | STORE | PLATFORM — who wrote this message. */
    @Column(nullable = false)
    private String senderRole;

    private String senderEmail;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String body;

    private Instant createdAt = Instant.now();
}
