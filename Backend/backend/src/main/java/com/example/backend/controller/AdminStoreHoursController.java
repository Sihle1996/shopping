package com.example.backend.controller;

import com.example.backend.entity.StoreHours;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.StoreHoursRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/store-hours")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminStoreHoursController {

    private final StoreHoursRepository storeHoursRepository;
    private final TenantRepository tenantRepository;

    @GetMapping
    public ResponseEntity<List<StoreHoursDTO>> getStoreHours() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.status(403).build();

        List<StoreHours> existing = storeHoursRepository.findByTenant_IdOrderByDayOfWeek(tenantId);

        // Fill in any missing days with defaults (open 08:00–22:00, not closed)
        List<StoreHoursDTO> result = new ArrayList<>();
        for (int day = 1; day <= 7; day++) {
            final int d = day;
            StoreHours sh = existing.stream().filter(h -> h.getDayOfWeek() == d).findFirst().orElse(null);
            if (sh != null) {
                result.add(new StoreHoursDTO(sh.getId(), sh.getDayOfWeek(), sh.getOpenTime(), sh.getCloseTime(), sh.isClosed()));
            } else {
                result.add(new StoreHoursDTO(null, day, "08:00", "22:00", false));
            }
        }
        return ResponseEntity.ok(result);
    }

    @PutMapping
    public ResponseEntity<List<StoreHoursDTO>> saveStoreHours(@RequestBody List<StoreHoursDTO> schedule) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.status(403).build();

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new RuntimeException("Tenant not found"));

        List<StoreHours> saved = new ArrayList<>();
        for (StoreHoursDTO dto : schedule) {
            if (dto.dayOfWeek() < 1 || dto.dayOfWeek() > 7) continue;
            StoreHours sh = storeHoursRepository
                    .findByTenant_IdAndDayOfWeek(tenantId, dto.dayOfWeek())
                    .orElse(new StoreHours());
            sh.setTenant(tenant);
            sh.setDayOfWeek(dto.dayOfWeek());
            sh.setOpenTime(dto.openTime() != null ? dto.openTime() : "08:00");
            sh.setCloseTime(dto.closeTime() != null ? dto.closeTime() : "22:00");
            sh.setClosed(dto.closed());
            saved.add(storeHoursRepository.save(sh));
        }

        return ResponseEntity.ok(saved.stream()
                .map(s -> new StoreHoursDTO(s.getId(), s.getDayOfWeek(), s.getOpenTime(), s.getCloseTime(), s.isClosed()))
                .toList());
    }

    record StoreHoursDTO(UUID id, int dayOfWeek, String openTime, String closeTime, boolean closed) {}
}
