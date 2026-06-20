package com.example.backend.controller;

import com.example.backend.config.AuthUtil;
import com.example.backend.entity.DriverLedgerEntry;
import com.example.backend.entity.Order;
import com.example.backend.entity.OrderDTO;
import com.example.backend.repository.DriverLedgerRepository;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.service.DriverService;
import com.example.backend.user.DriverStatus;
import com.example.backend.user.User;
import com.example.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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
    private final DriverLedgerRepository driverLedgerRepository;
    private final TenantRepository tenantRepository;

    @GetMapping("/orders")
    public ResponseEntity<List<OrderDTO>> getMyAssignedOrders(Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        return ResponseEntity.ok(driverService.getOrdersAssignedToDriver(driver));
    }

    @PostMapping("/orders/{orderId}/request-otp")
    public ResponseEntity<?> requestDeliveryOtp(@PathVariable UUID orderId, Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        try {
            return ResponseEntity.ok(driverService.requestDeliveryOtp(driver, orderId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/orders/{orderId}/verify-otp")
    public ResponseEntity<?> verifyDeliveryOtp(@PathVariable UUID orderId,
                                               @RequestBody Map<String, String> body,
                                               Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        String otp = body.get("otp");
        if (otp == null || otp.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "OTP is required"));
        }
        try {
            driverService.verifyDeliveryOtp(driver, orderId, otp);
            return ResponseEntity.ok(Map.of("message", "Order marked as delivered."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
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

    @GetMapping("/branding")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, String>> getBranding(Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        var tenant = driver.getTenant();
        if (tenant == null) {
            return ResponseEntity.ok(Map.of("primaryColor", "#E76F51", "storeName", "", "logoUrl", ""));
        }
        return ResponseEntity.ok(Map.of(
            "primaryColor", tenant.getPrimaryColor() != null ? tenant.getPrimaryColor() : "#E76F51",
            "storeName",    tenant.getName()         != null ? tenant.getName()         : "",
            "logoUrl",      tenant.getLogoUrl()      != null ? tenant.getLogoUrl()      : ""
        ));
    }

    @GetMapping("/earnings")
    public ResponseEntity<EarningsResponse> getEarnings(Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        UUID driverId = driver.getId();
        long deliveredCount = orderRepository.findByDriver(driver).stream()
                .filter(o -> "Delivered".equals(o.getStatus())).count();

        // Real, accruing pay from the driver ledger (base fee + tips). owed = not-yet-settled balance.
        double lifetime = driverLedgerRepository.sumEarnings(driverId).doubleValue();
        double owed = driverLedgerRepository.computeBalance(driverId).doubleValue();

        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.now(zone);
        Instant weekStart = today.with(DayOfWeek.MONDAY).atStartOfDay(zone).toInstant();
        Instant weekEnd = today.plusDays(1).atStartOfDay(zone).toInstant();
        double thisWeek = driverLedgerRepository.sumEarningsInPeriod(driverId, weekStart, weekEnd).doubleValue();

        // Look the base fee up by id (the lazy tenant proxy is detached here, so navigating it would
        // throw — but its id is known without a DB hit).
        double baseFee = 25.0;
        if (driver.getTenant() != null) {
            baseFee = tenantRepository.findById(driver.getTenant().getId())
                    .map(t -> t.getDriverBaseFee() != null ? t.getDriverBaseFee().doubleValue() : 25.0)
                    .orElse(25.0);
        }

        return ResponseEntity.ok(new EarningsResponse((int) deliveredCount,
                round(lifetime), round(thisWeek), round(owed), round(baseFee)));
    }

    @GetMapping("/earnings/breakdown")
    public ResponseEntity<List<DeliveryEarning>> getEarningsBreakdown(Authentication authentication) {
        User driver = authUtil.getCurrentUser(authentication);
        // Group the driver's EARNING/TIP ledger rows by order (entries come back most-recent-first).
        Map<UUID, double[]> sums = new LinkedHashMap<>();   // [base, tip]
        Map<UUID, Instant> dates = new LinkedHashMap<>();
        for (DriverLedgerEntry e : driverLedgerRepository.findByDriver_IdOrderByCreatedAtDesc(driver.getId())) {
            if (e.getOrder() == null) continue; // PAYOUT settlement entries have no order
            boolean earning = "EARNING".equals(e.getEntryType());
            boolean tip = "TIP".equals(e.getEntryType());
            if (!earning && !tip) continue;
            UUID oid = e.getOrder().getId();
            double[] bt = sums.computeIfAbsent(oid, k -> new double[2]);
            dates.putIfAbsent(oid, e.getCreatedAt());
            if (earning) bt[0] += e.getAmountRand().doubleValue();
            else bt[1] += e.getAmountRand().doubleValue();
        }
        List<DeliveryEarning> out = new ArrayList<>();
        for (Map.Entry<UUID, double[]> en : sums.entrySet()) {
            double[] bt = en.getValue();
            out.add(new DeliveryEarning(en.getKey().toString().substring(0, 8), dates.get(en.getKey()),
                    round(bt[0]), round(bt[1]), round(bt[0] + bt[1])));
        }
        return ResponseEntity.ok(out);
    }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }

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

    record EarningsResponse(int deliveredCount, double totalEarnings,
                            double thisWeekEarnings, double owedBalance, double baseFee) {}

    record DeliveryEarning(String orderId, Instant date, double base, double tip, double total) {}
}
