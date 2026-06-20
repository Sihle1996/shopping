package com.example.backend.service;

import com.example.backend.entity.Order;
import com.example.backend.entity.OrderDTO;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.DriverStatus;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DriverService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderService orderService;
    private final PayoutLedgerService payoutLedgerService;
    private final DriverLedgerService driverLedgerService;
    private final EmailService emailService;
    private final SimpMessagingTemplate messagingTemplate;
    private final AuditService auditService;

    public List<OrderDTO> getOrdersAssignedToDriver(User driver) {
        return orderRepository.findByDriver(driver)
                .stream()
                .map(orderService::convertToOrderDTO)
                .toList();
    }

    public Map<String, String> requestDeliveryOtp(User driver, UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!order.getDriver().getId().equals(driver.getId())) {
            throw new RuntimeException("Unauthorized to modify this order");
        }
        if ("Delivered".equals(order.getStatus()) || "Cancelled".equals(order.getStatus())) {
            throw new RuntimeException("Order is already " + order.getStatus());
        }

        // Auto-advance to Out for Delivery if not already there
        if (!"Out for Delivery".equals(order.getStatus())) {
            order.setStatus("Out for Delivery");
        }

        String otp = String.format("%06d", new SecureRandom().nextInt(1_000_000));
        order.setDeliveryOtp(otp);
        order.setOtpExpiresAt(Instant.now().plusSeconds(900)); // 15 minutes
        order.setOtpVerified(false);
        orderRepository.save(order);

        var dto = orderService.convertToOrderDTO(order);

        // Push real-time update so customer's track page shows OTP immediately
        if (order.getUser() != null) {
            messagingTemplate.convertAndSend("/topic/orders/" + order.getUser().getId(), dto);
        }

        String customerEmail = order.getUser() != null ? order.getUser().getEmail() : order.getGuestEmail();
        if (customerEmail != null && !customerEmail.isBlank()) {
            String storeName = order.getTenant() != null ? order.getTenant().getName() : "the store";
            String logoUrl = order.getTenant() != null ? order.getTenant().getLogoUrl() : null;
            String primaryColor = order.getTenant() != null ? order.getTenant().getPrimaryColor() : null;
            emailService.sendDeliveryOtp(customerEmail, otp, storeName, order.getId().toString(), logoUrl, primaryColor);
        }

        return Map.of("message", "OTP sent to customer", "otp", otp);
    }

    @org.springframework.transaction.annotation.Transactional
    public void verifyDeliveryOtp(User driver, UUID orderId, String otp) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!order.getDriver().getId().equals(driver.getId())) {
            throw new RuntimeException("Unauthorized to modify this order");
        }
        if (order.getDeliveryOtp() == null || order.getOtpExpiresAt() == null) {
            throw new RuntimeException("No OTP has been requested for this order");
        }
        if (Instant.now().isAfter(order.getOtpExpiresAt())) {
            throw new RuntimeException("OTP has expired — request a new one");
        }
        if (!order.getDeliveryOtp().equals(otp)) {
            throw new RuntimeException("Incorrect OTP");
        }

        order.setOtpVerified(true);
        order.setDeliveryOtp(null);
        order.setOtpExpiresAt(null);
        order.setStatus("Delivered");
        order.setDeliveredBy("DRIVER_OTP"); // gold standard — customer-confirmed
        if (order.getDeliveredAt() == null) order.setDeliveredAt(java.time.Instant.now());
        payoutLedgerService.recordOrderCredit(order); // credit the store (idempotent) — driver deliveries were previously never credited
        driverLedgerService.recordDriverCredit(order); // credit the driver their base pay + tip (idempotent)
        orderRepository.save(order);
        orderService.recordDeliveryPerformance(order);
        auditService.log(AuditService.DRIVER, "ORDER_DELIVERED", "ORDER", orderId, "Delivered — OTP confirmed");

        var dto = orderService.convertToOrderDTO(order);
        if (order.getUser() != null) {
            messagingTemplate.convertAndSend("/topic/orders/" + order.getUser().getId(), dto);
        }
        messagingTemplate.convertAndSend("/topic/orders", Map.of(
                "type", "ORDER_UPDATED",
                "orderId", order.getId().toString(),
                "status", "Delivered"
        ));

        String customerEmail = order.getUser() != null ? order.getUser().getEmail() : order.getGuestEmail();
        if (customerEmail != null && !customerEmail.isBlank()) {
            String storeName = order.getTenant() != null ? order.getTenant().getName() : "the store";
            String logoUrl = order.getTenant() != null ? order.getTenant().getLogoUrl() : null;
            String primaryColor = order.getTenant() != null ? order.getTenant().getPrimaryColor() : null;
            emailService.sendOrderDelivered(customerEmail, dto, storeName, logoUrl, primaryColor);
        }
    }

    @org.springframework.transaction.annotation.Transactional
    public void markOrderDelivered(User driver, UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!order.getDriver().getId().equals(driver.getId())) {
            throw new RuntimeException("Unauthorized to modify this order");
        }
        if ("Delivered".equals(order.getStatus())) {
            return; // already delivered — don't re-fire the email / double-count
        }

        order.setStatus("Delivered");
        order.setDeliveredBy("DRIVER"); // driver-confirmed without an OTP
        if (order.getDeliveredAt() == null) order.setDeliveredAt(java.time.Instant.now());
        payoutLedgerService.recordOrderCredit(order); // credit the store (idempotent) — driver deliveries were previously never credited
        driverLedgerService.recordDriverCredit(order); // credit the driver their base pay + tip (idempotent)
        orderRepository.save(order);
        orderService.recordDeliveryPerformance(order);
        auditService.log(AuditService.DRIVER, "ORDER_DELIVERED", "ORDER", orderId, "Delivered by driver");

        var dto = orderService.convertToOrderDTO(order);
        if (order.getUser() != null) {
            messagingTemplate.convertAndSend("/topic/orders/" + order.getUser().getId(), dto);
        }
        messagingTemplate.convertAndSend("/topic/orders", Map.of(
                "type", "ORDER_UPDATED",
                "orderId", order.getId().toString(),
                "status", "Delivered"
        ));

        String customerEmail = order.getUser() != null ? order.getUser().getEmail() : order.getGuestEmail();
        if (customerEmail != null && !customerEmail.isBlank()) {
            String storeName = order.getTenant() != null ? order.getTenant().getName() : "the store";
            String logoUrl = order.getTenant() != null ? order.getTenant().getLogoUrl() : null;
            String primaryColor = order.getTenant() != null ? order.getTenant().getPrimaryColor() : null;
            emailService.sendOrderDelivered(customerEmail, dto, storeName, logoUrl, primaryColor);
        }
    }

    public void updateAvailability(User driver, DriverStatus status) {
        DriverStatus old = driver.getDriverStatus();
        driver.setDriverStatus(status);
        userRepository.save(driver);
        // Capture the change so availability history accumulates (for future peak-coverage insight).
        if (status != null && status != old) {
            auditService.log(driver.getTenant() != null ? driver.getTenant().getId() : null,
                    AuditService.DRIVER, "DRIVER_AVAILABILITY", "DRIVER", driver.getId(),
                    driver.getEmail() + " → " + status.name());
        }
    }
}
