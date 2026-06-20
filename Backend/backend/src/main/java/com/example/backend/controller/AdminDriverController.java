package com.example.backend.controller;

import com.example.backend.auth.RegisterRequest;
import com.example.backend.entity.DriverDTO;
import com.example.backend.entity.DriverLocationDTO;
import com.example.backend.service.AdminDriverService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/drivers")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDriverController {

    private final AdminDriverService adminDriverService;

    @PostMapping
    public ResponseEntity<DriverDTO> createDriver(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(adminDriverService.createDriver(request));
    }

    @GetMapping
    public ResponseEntity<List<DriverDTO>> getAllDrivers() {
        return ResponseEntity.ok(adminDriverService.getAllDrivers());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDriver(@PathVariable UUID id) {
        adminDriverService.deleteDriver(id);
        return ResponseEntity.ok(Map.of("message", "Driver deleted"));
    }

    @GetMapping("/locations")
    public ResponseEntity<List<DriverLocationDTO>> getDriverLocations() {
        return ResponseEntity.ok(adminDriverService.getDriverLocations());
    }

    /** Settlement — record that the store paid this driver, clearing that much of their owed balance. */
    @PostMapping("/{id}/payout")
    public ResponseEntity<?> recordPayout(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        try {
            java.math.BigDecimal amount = new java.math.BigDecimal(String.valueOf(body.getOrDefault("amount", "0")));
            String note = body.get("note") != null ? String.valueOf(body.get("note")) : null;
            return ResponseEntity.ok(adminDriverService.recordPayout(id, amount, note));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}

