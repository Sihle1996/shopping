package com.example.backend.service;

import com.example.backend.entity.*;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.user.User;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@RequiredArgsConstructor
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final MenuItemRepository menuItemRepository;

    // ✅ PayPal order creation
    @Transactional
    public OrderDTO placeOrderFromPayment(OrderRequestDTO request, User user) {
        List<OrderItem> orderItems = new ArrayList<>();

        for (OrderItemDTO itemDTO : request.getItems()) {
            OrderItem item = new OrderItem();
            item.setName(itemDTO.getName());
            item.setQuantity(itemDTO.getQuantity());
            item.setTotalPrice(itemDTO.getPrice() * itemDTO.getQuantity());
            item.setSize(itemDTO.getSize());

            // ✅ Link menu item
            item.setMenuItem(menuItemRepository.findById(itemDTO.getProductId())
                    .orElseThrow(() -> new RuntimeException("Menu item not found: " + itemDTO.getProductId())));

            orderItems.add(item);
        }

        double totalAmount = BigDecimal.valueOf(request.getTotal())
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();

        Order order = new Order();
        order.setUser(user);
        order.setOrderItems(orderItems);
        order.setTotalAmount(totalAmount);
        order.setOrderDate(Instant.now());
        order.setStatus(request.getStatus());
        order.setDeliveryAddress(request.getDeliveryAddress());
        order.setPaymentId(request.getPaymentId());
        order.setPayerId(request.getPayerId());

        // ✅ Set back-reference to Order for each OrderItem
        for (OrderItem item : orderItems) {
            item.setOrder(order);
        }

        Order saved = orderRepository.save(order);
        return convertToOrderDTO(saved);
    }

    public List<OrderDTO> getOrdersByUser(Long userId) {
        return orderRepository.findByUserId(userId).stream()
                .map(this::convertToOrderDTO)
                .toList();
    }

    public List<OrderDTO> getAllOrders() {
        return orderRepository.findAll().stream()
                .map(this::convertToOrderDTO)
                .toList();
    }

    public OrderDTO getOrderById(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        return convertToOrderDTO(order);
    }

    @Transactional
    public void deleteOrder(Long orderId) {
        if (!orderRepository.existsById(orderId)) {
            throw new RuntimeException("Order not found");
        }
        orderRepository.deleteById(orderId);
    }

    public List<OrderDTO> getOrdersByStatus(String status) {
        return orderRepository.findByStatus(status).stream()
                .map(this::convertToOrderDTO)
                .toList();
    }

    public Page<OrderDTO> getPaginatedOrders(int page, int size, String sortBy) {
        return orderRepository.findAll(PageRequest.of(page, size, Sort.by(sortBy)))
                .map(this::convertToOrderDTO);
    }

    @Transactional
    public OrderDTO updateOrderStatus(Long orderId, String status) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        order.setStatus(status);
        return convertToOrderDTO(orderRepository.save(order));
    }

    private OrderDTO convertToOrderDTO(Order order) {
        LocalDateTime sastDateTime = LocalDateTime.ofInstant(order.getOrderDate(), ZoneId.of("Africa/Johannesburg"));
        String formattedDate = sastDateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        List<OrderItemDTO> itemDTOs = order.getOrderItems().stream().map(item -> {
            OrderItemDTO dto = new OrderItemDTO();
            dto.setName(item.getName());
            dto.setQuantity(item.getQuantity());
            dto.setSize(item.getSize());
            dto.setPrice(item.getTotalPrice()); // Optional: include price
            return dto;
        }).toList();

        return new OrderDTO(
                order.getId(),
                order.getTotalAmount(),
                order.getStatus(),
                formattedDate,
                order.getDeliveryAddress(),
                order.getUser().getId(),
                order.getUser().getEmail(),
                order.getPaymentId(),
                order.getPayerId(),
                itemDTOs // ✅ include itemDTOs
        );
    }



    public long getTotalOrders() {
        return orderRepository.count();
    }

    public double getTotalRevenue() {
        return orderRepository.findAll()
                .stream()
                .mapToDouble(Order::getTotalAmount)
                .sum();
    }

    public long getPendingOrdersCount() {
        return orderRepository.findByStatus("Pending").size();
    }

}
