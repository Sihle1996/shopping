package com.example.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/** Audit trail of every action the AI copilot applied (after the admin confirmed). */
@Entity
@Table(name = "ai_action_log")
@Data
@NoArgsConstructor
public class AiActionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    @JsonIgnore
    private Tenant tenant;

    @Column(nullable = false, length = 64)
    private String action;

    @Column(columnDefinition = "text")
    private String params;

    @Column(nullable = false, length = 20)
    private String status; // APPLIED | FAILED

    @Column(columnDefinition = "text")
    private String message;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
