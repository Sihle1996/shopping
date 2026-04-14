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
    private final EmailService emailService;
    private final SimpMessagingTemplate messagingTemplate;

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
            emailService.sendDeliveryOtp(customerEmail, otp, storeName, order.getId().toString());
        }

        return Map.of("message", "OTP sent to customer");
    }

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
        orderRepository.save(order);

        var dto = orderService.convertToOrderDTO(order);
        if (order.getUser() != null) {
            messagingTemplate.convertAndSend("/topic/orders/" + order.getUser().getId(), dto);
        }

        String customerEmail = order.getUser() != null ? order.getUser().getEmail() : order.getGuestEmail();
        if (customerEmail != null && !customerEmail.isBlank()) {
            String storeName = order.getTenant() != null ? order.getTenant().getName() : "the store";
            emailService.sendOrderDelivered(customerEmail, dto, storeName);
        }
    }

    public void markOrderDelivered(User driver, UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!order.getDriver().getId().equals(driver.getId())) {
            throw new RuntimeException("Unauthorized to modify this order");
        }

        order.setStatus("Delivered");
        orderRepository.save(order);

        var dto = orderService.convertToOrderDTO(order);
        if (order.getUser() != null) {
            messagingTemplate.convertAndSend("/topic/orders/" + order.getUser().getId(), dto);
        }

        String customerEmail = order.getUser() != null ? order.getUser().getEmail() : order.getGuestEmail();
        if (customerEmail != null && !customerEmail.isBlank()) {
            String storeName = order.getTenant() != null ? order.getTenant().getName() : "the store";
            emailService.sendOrderDelivered(customerEmail, dto, storeName);
        }
    }

    public void updateAvailability(User driver, DriverStatus status) {
        driver.setDriverStatus(status);
        userRepository.save(driver);
    }
}
