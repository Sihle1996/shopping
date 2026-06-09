package com.example.backend.service;

import com.example.backend.entity.AuditEvent;
import com.example.backend.repository.AuditEventRepository;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/** Writes the human-readable activity trail. Resolves the actor from the security context, so
 *  callers just say what happened. Auditing failures never break the underlying action. */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    public static final String ADMIN = "ADMIN", DRIVER = "DRIVER", AI = "AI", SYSTEM = "SYSTEM";

    private final AuditEventRepository repository;

    public void log(String source, String action, String entityType, UUID entityId, String summary) {
        log(null, source, action, entityType, entityId, summary);
    }

    /** Runs in its own transaction so a rolled-back action still leaves its (failed-attempt) trace
     *  out, and an audit error can't poison the caller's transaction. {@code explicitTenantId} is for
     *  system/scheduled callers with no request context (pass the entity's tenant). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(UUID explicitTenantId, String source, String action, String entityType, UUID entityId, String summary) {
        try {
            UUID tenantId = explicitTenantId != null ? explicitTenantId : TenantContext.getCurrentTenantId();
            String email = null, role = null;
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof User u) {
                email = u.getEmail();
                role = u.getRole() != null ? u.getRole().name() : null;
                if (tenantId == null && u.getTenant() != null) tenantId = u.getTenant().getId();
            }
            repository.save(AuditEvent.builder()
                    .tenantId(tenantId).actorEmail(email).actorRole(role)
                    .source(source).action(action).entityType(entityType).entityId(entityId)
                    .summary(summary).createdAt(Instant.now()).build());
        } catch (Exception e) {
            log.warn("Audit log failed for {} {}: {}", action, entityId, e.getMessage());
        }
    }
}
