package com.example.backend.controller;

import com.example.backend.auth.RegisterRequest;
import com.example.backend.entity.DriverDTO;
import com.example.backend.service.AdminDriverService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
    public ResponseEntity<?> deleteDriver(@PathVariable Long id) {
        adminDriverService.deleteDriver(id);
        return ResponseEntity.ok(Map.of("message", "Driver deleted"));
    }
}

