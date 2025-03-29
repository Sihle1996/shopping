package com.example.backend.controller;

import com.example.backend.config.AuthUtil;
import com.example.backend.entity.OrderDTO;
import com.example.backend.service.DriverService;
import com.example.backend.user.DriverStatus;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/driver")
@RequiredArgsConstructor
@PreAuthorize("hasRole('DRIVER')")
public class DriverController {

    private final DriverService driverService;
    private final AuthUtil authUtil;

    @GetMapping("/orders")
    public ResponseEntity<List<OrderDTO>> getMyAssignedOrders(Principal principal) {
        User driver = authUtil.getCurrentUser(principal);
        return ResponseEntity.ok(driverService.getOrdersAssignedToDriver(driver));
    }

    @PutMapping("/orders/{orderId}/delivered")
    public ResponseEntity<?> markOrderAsDelivered(@PathVariable Long orderId, Principal principal) {
        User driver = authUtil.getCurrentUser(principal);
        driverService.markOrderDelivered(driver, orderId);
        return ResponseEntity.ok(Map.of("message", "Order marked as delivered."));
    }

    @PutMapping("/availability")
    public ResponseEntity<?> updateAvailability(@RequestParam DriverStatus status, Principal principal) {
        User driver = authUtil.getCurrentUser(principal);
        driverService.updateAvailability(driver, status);
        return ResponseEntity.ok(Map.of("message", "Availability updated."));
    }
}
