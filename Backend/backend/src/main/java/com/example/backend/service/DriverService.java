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
import java.util.List;
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

    public void markOrderDelivered(User driver, UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!order.getDriver().getId().equals(driver.getId())) {
            throw new RuntimeException("Unauthorized to modify this order");
        }

        order.setStatus("Delivered");
        orderRepository.save(order);

        var dto = orderService.convertToOrderDTO(order);
        // Push real-time update to customer
        messagingTemplate.convertAndSend("/topic/orders/" + order.getUser().getId(), dto);

        // Send delivery email to customer
        String customerEmail = order.getUser().getEmail();
        String storeName = order.getTenant() != null ? order.getTenant().getName() : "the store";
        emailService.sendOrderDelivered(customerEmail, dto, storeName);
    }

    public void updateAvailability(User driver, DriverStatus status) {
        driver.setDriverStatus(status);
        userRepository.save(driver);
    }
}
