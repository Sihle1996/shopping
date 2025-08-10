package com.example.backend.controller;

import com.example.backend.service.DiagnosticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminHealthController {

    private final DiagnosticsService diagnosticsService;

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        diagnosticsService.recordRestPing();
        return ResponseEntity.ok(diagnosticsService.healthSnapshot());
    }
}
