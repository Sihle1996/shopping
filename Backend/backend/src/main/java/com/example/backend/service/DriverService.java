package com.example.backend.service;

import com.example.backend.entity.Order;
import com.example.backend.entity.OrderDTO;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.DriverStatus;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DriverService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderService orderService; // For convertToOrderDTO()

    public List<OrderDTO> getOrdersAssignedToDriver(User driver) {
        return orderRepository.findByDriver(driver)
                .stream()
                .map(orderService::convertToOrderDTO)
                .toList();
    }

    public void markOrderDelivered(User driver, Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!order.getDriver().getId().equals(driver.getId())) {
            throw new RuntimeException("Unauthorized to modify this order");
        }

        order.setStatus("Delivered");
        orderRepository.save(order);
    }

    public void updateAvailability(User driver, DriverStatus status) {
        driver.setDriverStatus(status);
        userRepository.save(driver);
    }
}
