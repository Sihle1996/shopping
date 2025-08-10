package com.example.backend.service;

import com.example.backend.entity.*;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.repository.InventoryLogRepository;
import com.example.backend.user.DriverStatus;
import com.example.backend.user.Role;
import com.example.backend.user.User;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;

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
    private final InventoryLogRepository inventoryLogRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public OrderDTO placeOrderFromPayment(OrderRequestDTO request, User user) {
        List<OrderItem> orderItems = new ArrayList<>();

        for (OrderItemDTO itemDTO : request.getItems()) {
            OrderItem item = new OrderItem();
            item.setName(itemDTO.getName());
            item.setQuantity(itemDTO.getQuantity());
            item.setTotalPrice(itemDTO.getPrice() * itemDTO.getQuantity());
            item.setSize(itemDTO.getSize());
            MenuItem menuItem = menuItemRepository.findById(itemDTO.getProductId())
                    .orElseThrow(() -> new RuntimeException("Menu item not found: " + itemDTO.getProductId()));
            menuItem.setStock(menuItem.getStock() - itemDTO.getQuantity());
            menuItem.setReservedStock(menuItem.getReservedStock() + itemDTO.getQuantity());
            menuItemRepository.save(menuItem);

            InventoryLog log = new InventoryLog();
            log.setMenuItem(menuItem);
            log.setStockChange(-itemDTO.getQuantity());
            log.setReservedChange(itemDTO.getQuantity());
            log.setType("ORDER_PAYMENT");
            inventoryLogRepository.save(log);

            item.setMenuItem(menuItem);
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

        for (OrderItem item : orderItems) {
            item.setOrder(order);
        }

        Order saved = orderRepository.save(order);
        OrderDTO dto = convertToOrderDTO(saved);
        messagingTemplate.convertAndSendToUser(
                String.valueOf(user.getId()),
                "/queue/orders",
                dto
        );
        return dto;
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

    public List<User> getAvailableDrivers() {
        return userRepository.findByRoleAndDriverStatus(Role.DRIVER, DriverStatus.AVAILABLE);
    }

    @Transactional
    public OrderDTO assignDriverToOrder(Long orderId, Long driverId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        User driver = userRepository.findById(driverId)
                .orElseThrow(() -> new RuntimeException("Driver not found"));

        if (driver.getRole() != Role.DRIVER || driver.getDriverStatus() != DriverStatus.AVAILABLE) {
            throw new RuntimeException("Driver is not available");
        }

        order.setDriver(driver);
        driver.setDriverStatus(DriverStatus.UNAVAILABLE);

        userRepository.save(driver);
        Order updated = orderRepository.save(order);
        return convertToOrderDTO(updated);
    }

    public OrderDTO convertToOrderDTO(Order order) {
        LocalDateTime sastDateTime = LocalDateTime.ofInstant(order.getOrderDate(), ZoneId.of("Africa/Johannesburg"));
        String formattedDate = sastDateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        List<OrderItemDTO> itemDTOs = order.getOrderItems().stream().map(item -> {
            OrderItemDTO dto = new OrderItemDTO();
            dto.setName(item.getName());
            dto.setQuantity(item.getQuantity());
            dto.setSize(item.getSize());
            dto.setPrice(item.getTotalPrice());
            return dto;
        }).toList();

        OrderDTO dto = new OrderDTO(
                order.getId(),
                order.getTotalAmount(),
                order.getStatus(),
                formattedDate,
                order.getDeliveryAddress(),
                order.getUser().getId(),
                order.getUser().getEmail(),
                order.getPaymentId(),
                order.getPayerId(),
                itemDTOs,
                null // driverName, set below
        );

        if (order.getDriver() != null) {
            dto.setDriverName(order.getDriver().getEmail()); // or .getFullName() if you have it
        }

        return dto;
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
