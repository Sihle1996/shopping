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

        return ResponseEntity.ok(ticketRepository.save(ticket));
    }

    /** Customer: view their own tickets */
    @GetMapping("/api/support/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<SupportTicket>> myTickets(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ticketRepository.findByUser_IdOrderByCreatedAtDesc(user.getId()));
    }

    /** Admin: list all tickets for their tenant */
    @GetMapping("/api/admin/support")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<SupportTicket>> adminTickets() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(ticketRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId));
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
            return ResponseEntity.ok(ticketRepository.save(ticket));
        }).orElse(ResponseEntity.notFound().build());
    }
}
