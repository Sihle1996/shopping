package com.example.backend.service;

import com.example.backend.entity.Order;
import com.example.backend.entity.OrderDTO;
import com.example.backend.entity.OrderItem;
import com.example.backend.repository.CartItemRepository;
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
    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;

    // ✅ Place an Order
    @Transactional
    public OrderDTO placeOrder(Long userId, List<Long> cartItemIds, String deliveryAddress) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<OrderItem> orderItems = new ArrayList<>();
        double totalAmount = 0;

        for (Long cartItemId : cartItemIds) {
            var cartItem = cartItemRepository.findById(cartItemId)
                    .orElseThrow(() -> new RuntimeException("Cart item not found"));

            var orderItem = new OrderItem();
            orderItem.setMenuItem(cartItem.getMenuItem());
            orderItem.setQuantity(cartItem.getQuantity());
            orderItem.setTotalPrice(cartItem.getTotalPrice());
            orderItems.add(orderItem);

            totalAmount += cartItem.getTotalPrice();
            cartItemRepository.delete(cartItem);
        }

        // ✅ Round totalAmount to 2 decimal places
        totalAmount = BigDecimal.valueOf(totalAmount).setScale(2, RoundingMode.HALF_UP).doubleValue();

        // ✅ Store order in UTC
        var order = new Order(user, orderItems, totalAmount, Instant.now(), "PENDING", deliveryAddress);
        Order savedOrder = orderRepository.save(order);

        return convertToOrderDTO(savedOrder); // ✅ Return OrderDTO
    }

    // ✅ Get Orders by User
    public List<OrderDTO> getOrdersByUser(Long userId) {
        return orderRepository.findByUserId(userId).stream()
                .map(this::convertToOrderDTO)
                .toList();
    }

    // ✅ Get All Orders (For Admin)
    public List<OrderDTO> getAllOrders() {
        return orderRepository.findAll().stream()
                .map(order -> {
                    if (order.getUser() == null) {
                        throw new RuntimeException("User not found for order ID: " + order.getId());
                    }
                    return convertToOrderDTO(order);
                })
                .toList();
    }

    // ✅ Get Order by ID
    public OrderDTO getOrderById(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        return convertToOrderDTO(order);
    }

    // ✅ Delete Order
    @Transactional
    public void deleteOrder(Long orderId) {
        if (!orderRepository.existsById(orderId)) {
            throw new RuntimeException("Order not found");
        }
        orderRepository.deleteById(orderId);
    }

    // ✅ Get Orders by Status
    public List<OrderDTO> getOrdersByStatus(String status) {
        return orderRepository.findByStatus(status).stream()
                .map(this::convertToOrderDTO)
                .toList();
    }

    // ✅ Paginated Orders (Admin)
    public Page<OrderDTO> getPaginatedOrders(int page, int size, String sortBy) {
        return orderRepository.findAll(PageRequest.of(page, size, Sort.by(sortBy)))
                .map(this::convertToOrderDTO);
    }

    // ✅ Update Order Status
    @Transactional
    public OrderDTO updateOrderStatus(Long orderId, String status) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        order.setStatus(status);
        Order updatedOrder = orderRepository.save(order);
        return convertToOrderDTO(updatedOrder);
    }

    // ✅ Convert Order to OrderDTO (Handles SAST Time Conversion)
    private OrderDTO convertToOrderDTO(Order order) {
        if (order.getOrderDate() == null) {
            throw new RuntimeException("Order date is missing for order ID: " + order.getId());
        }

        // Convert UTC Instant to South African Standard Time (SAST)
        LocalDateTime sastDateTime = LocalDateTime.ofInstant(order.getOrderDate(), ZoneId.of("Africa/Johannesburg"));
        String formattedDate = sastDateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        return new OrderDTO(
                order.getId(),
                order.getTotalAmount(),
                order.getStatus(),
                formattedDate, // ✅ Readable date format
                order.getDeliveryAddress(),
                order.getUser().getId(),
                order.getUser().getEmail()
        );
    }
}
