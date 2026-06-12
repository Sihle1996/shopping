package com.example.backend.controller;

import com.example.backend.entity.SupportTicket;
import com.example.backend.repository.SupportTicketRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class SupportController {

    private final SupportTicketRepository ticketRepository;
    private final TenantRepository tenantRepository;

    /** Customer: submit a new support ticket */
    @PostMapping("/api/support")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> submit(@RequestBody Map<String, String> body,
                                    @AuthenticationPrincipal User user) {
        String subject = body.get("subject");
        String message = body.get("message");
        if (subject == null || subject.isBlank() || message == null || message.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Subject and message are required"));
        }

        SupportTicket ticket = new SupportTicket();
        ticket.setUser(user);
        ticket.setSubject(subject.trim());
        ticket.setMessage(message.trim());

        String orderIdStr = body.get("orderId");
        if (orderIdStr != null && !orderIdStr.isBlank()) {
            try { ticket.setOrderId(UUID.fromString(orderIdStr)); } catch (IllegalArgumentException ignored) {}
        }

        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            tenantRepository.findById(tenantId).ifPresent(ticket::setTenant);
        }

        return ResponseEntity.ok(toDto(ticketRepository.save(ticket)));
    }

    /** Customer: view their own tickets */
    @GetMapping("/api/support/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TicketDTO>> myTickets(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(
            ticketRepository.findByUser_IdOrderByCreatedAtDesc(user.getId())
                .stream().map(this::toDto).toList());
    }

    /** Customer: escalate their own ticket to the platform (CraveIt) when the store hasn't resolved it.
     *  Escalated tickets become visible to the superadmin so a store can't quietly mistreat customers. */
    @PostMapping("/api/support/{id}/escalate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> escalate(@PathVariable UUID id,
                                      @RequestBody(required = false) Map<String, String> body,
                                      @AuthenticationPrincipal User user) {
        SupportTicket ticket = ticketRepository.findById(id).orElse(null);
        if (ticket == null) return ResponseEntity.notFound().build();
        if (ticket.getUser() == null || !ticket.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body(Map.of("error", "This isn't your ticket"));
        }
        if (ticket.isEscalated()) {
            return ResponseEntity.badRequest().body(Map.of("error", "This ticket is already with CraveIt"));
        }
        ticket.setEscalated(true);
        ticket.setEscalatedAt(Instant.now());
        String reason = body != null ? body.get("reason") : null;
        if (reason != null && !reason.isBlank()) ticket.setEscalationReason(reason.trim());
        return ResponseEntity.ok(toDto(ticketRepository.save(ticket)));
    }

    /** Admin: list all tickets for their tenant */
    @GetMapping("/api/admin/support")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<TicketDTO>> adminTickets() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(
            ticketRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId)
                .stream().map(this::toDto).toList());
    }

    /** Admin: update ticket status and notes */
    @PatchMapping("/api/admin/support/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> update(@PathVariable UUID id,
                                    @RequestBody Map<String, String> body) {
        return ticketRepository.findById(id).map(ticket -> {
            if (body.containsKey("status")) {
                try {
                    ticket.setStatus(SupportTicket.TicketStatus.valueOf(body.get("status")));
                    if (ticket.getStatus() == SupportTicket.TicketStatus.RESOLVED
                            || ticket.getStatus() == SupportTicket.TicketStatus.CLOSED) {
                        ticket.setResolvedAt(Instant.now());
                    }
                } catch (IllegalArgumentException ignored) {}
            }
            if (body.containsKey("adminNotes")) {
                ticket.setAdminNotes(body.get("adminNotes"));
            }
            return ResponseEntity.ok(toDto(ticketRepository.save(ticket)));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Map entity -> DTO to avoid serializing lazy Hibernate proxies (user/tenant). */
    private TicketDTO toDto(SupportTicket t) {
        TicketUserDTO userDto = null;
        try {
            if (t.getUser() != null) {
                userDto = new TicketUserDTO(t.getUser().getEmail(), t.getUser().getFullName());
            }
        } catch (Exception ignored) {
            // lazy association unavailable — omit user rather than failing the request
        }
        return new TicketDTO(
            t.getId(), t.getSubject(), t.getMessage(),
            t.getStatus() != null ? t.getStatus().name() : null,
            t.getAdminNotes(), t.getOrderId(),
            t.getCreatedAt(), t.getResolvedAt(), userDto,
            t.isEscalated(), t.getEscalatedAt(), t.getEscalationReason());
    }

    record TicketUserDTO(String email, String fullName) {}

    record TicketDTO(UUID id, String subject, String message, String status,
                     String adminNotes, UUID orderId, Instant createdAt,
                     Instant resolvedAt, TicketUserDTO user,
                     boolean escalated, Instant escalatedAt, String escalationReason) {}
}
