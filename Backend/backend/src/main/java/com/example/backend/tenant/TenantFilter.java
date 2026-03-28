package com.example.backend.tenant;

import com.example.backend.repository.TenantRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Resolves tenant from:
 * 1. X-Tenant-Id header (API clients)
 * 2. Path-based: /store/{slug}/... (customer-facing)
 * 3. JWT claim (authenticated users — set by JwtAuthenticationFilter)
 */
@Component
@Order(1)
@RequiredArgsConstructor
public class TenantFilter extends OncePerRequestFilter {

    private final TenantRepository tenantRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            // 1. Check X-Tenant-Id header
            String tenantHeader = request.getHeader("X-Tenant-Id");
            if (tenantHeader != null && !tenantHeader.isBlank()) {
                try {
                    TenantContext.setCurrentTenantId(UUID.fromString(tenantHeader));
                } catch (IllegalArgumentException ignored) {
                    // Invalid UUID — skip
                }
            }

            // 2. Check path-based: /store/{slug}/...
            if (TenantContext.getCurrentTenantId() == null) {
                String path = request.getRequestURI();
                if (path.startsWith("/store/")) {
                    String[] parts = path.split("/");
                    if (parts.length >= 3) {
                        String slug = parts[2];
                        tenantRepository.findBySlug(slug)
                                .ifPresent(tenant -> TenantContext.setCurrentTenantId(tenant.getId()));
                    }
                }
            }

            // Note: tenant can also be set by JwtAuthenticationFilter from JWT claims
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/superadmin")
                || path.startsWith("/api/tenants/register")
                || path.startsWith("/ws");
    }
}
