package com.example.backend.controller;

import com.example.backend.config.AuthUtil;
import com.example.backend.entity.Order;
import com.example.backend.entity.OrderDTO;
import com.example.backend.repository.OrderRepository;
import com.example.backend.service.DriverService;
import com.example.backend.user.DriverStatus;
import com.example.backend.user.User;
import com.example.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/driver")
@RequiredArgsConstructor
@PreAuthorize("hasRole('DRIVER')")
public class DriverController {

    private final DriverService driverService;
    private final AuthUtil authUtil;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    @GetMapping("/orders")
    public ResponseEntity<List<OrderDTO>> getMyAssignedOrders(Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        return ResponseEntity.ok(driverService.getOrdersAssignedToDriver(driver));
    }

    @PutMapping("/orders/{orderId}/delivered")
    public ResponseEntity<?> markOrderAsDelivered(@PathVariable UUID orderId, Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        driverService.markOrderDelivered(driver, orderId);
        return ResponseEntity.ok(Map.of("message", "Order marked as delivered."));
    }

    @PutMapping("/availability")
    public ResponseEntity<?> updateAvailability(@RequestParam DriverStatus status, Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        driverService.updateAvailability(driver, status);
        return ResponseEntity.ok(Map.of("message", "Availability updated."));
    }

    @GetMapping("/profile")
    public ResponseEntity<DriverProfileResponse> getProfile(Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        return ResponseEntity.ok(DriverProfileResponse.from(driver));
    }

    @PutMapping("/profile")
    public ResponseEntity<DriverProfileResponse> updateProfile(
            @RequestBody DriverProfileRequest req,
            Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        if (req.fullName() != null) driver.setFullName(req.fullName());
        if (req.phone() != null) driver.setPhone(req.phone());
        if (req.vehicleType() != null) driver.setVehicleType(req.vehicleType());
        if (req.vehiclePlate() != null) driver.setVehiclePlate(req.vehiclePlate());
        userRepository.save(driver);
        return ResponseEntity.ok(DriverProfileResponse.from(driver));
    }

    @GetMapping("/earnings")
    public ResponseEntity<EarningsResponse> getEarnings(Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        List<Order> delivered = orderRepository.findByDriver(driver)
                .stream().filter(o -> "Delivered".equals(o.getStatus())).toList();
        double total = delivered.stream()
                .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() * 0.1 : 0)
                .sum();
        return ResponseEntity.ok(new EarningsResponse(delivered.size(), Math.round(total * 100.0) / 100.0));
    }

    record DriverProfileResponse(String fullName, String phone, String vehicleType,
                                  String vehiclePlate, String email, String driverStatus) {
        static DriverProfileResponse from(User u) {
            return new DriverProfileResponse(
                u.getFullName(), u.getPhone(), u.getVehicleType(), u.getVehiclePlate(),
                u.getEmail(), u.getDriverStatus() != null ? u.getDriverStatus().name() : null
            );
        }
    }

    record DriverProfileRequest(String fullName, String phone, String vehicleType, String vehiclePlate) {}

    record EarningsResponse(int deliveredCount, double totalEarnings) {}
}
