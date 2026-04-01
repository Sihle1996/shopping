package com.example.backend.service;

import com.example.backend.entity.*;
import com.example.backend.model.Promotion;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.repository.InventoryLogRepository;
import com.example.backend.tenant.TenantContext;
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
import java.util.UUID;

@RequiredArgsConstructor
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final MenuItemRepository menuItemRepository;
    private final InventoryLogRepository inventoryLogRepository;
    private final TenantRepository tenantRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final PromotionService promotionService;
    private final EmailService emailService;

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

            // Only adjust stock if it's being tracked (stock > 0)
            int newStock = menuItem.getStock() - itemDTO.getQuantity();
            if (newStock >= 0) {
                menuItem.setStock(newStock);
                menuItem.setReservedStock(menuItem.getReservedStock() + itemDTO.getQuantity());
            }
            menuItemRepository.save(menuItem);

            InventoryLog log = new InventoryLog();
            log.setMenuItem(menuItem);
            log.setStockChange(-itemDTO.getQuantity());
            log.setReservedChange(itemDTO.getQuantity());
            log.setType("ORDER_PAYMENT");
            UUID logTenantId = TenantContext.getCurrentTenantId();
            if (logTenantId != null) {
                tenantRepository.findById(logTenantId).ifPresent(log::setTenant);
            }
            inventoryLogRepository.save(log);

            item.setMenuItem(menuItem);
            orderItems.add(item);
        }

        double subtotal = BigDecimal.valueOf(request.getTotal())
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();

        // Apply promotion discount server-side
        double discountAmount = 0.0;
        String appliedPromoCode = null;

        java.util.Optional<Promotion> promoOpt = (request.getPromoCode() != null && !request.getPromoCode().isBlank())
                ? promotionService.validateCode(request.getPromoCode())
                : promotionService.findAutoAppliedAllPromo();

        if (promoOpt.isPresent()) {
            Promotion promo = promoOpt.get();
            if (promo.getDiscountPercent() != null) {
                double pct = promo.getDiscountPercent().doubleValue() / 100.0;
                if (promo.getAppliesTo() == Promotion.AppliesTo.ALL) {
                    discountAmount = subtotal * pct;
                } else if (promo.getAppliesTo() == Promotion.AppliesTo.PRODUCT
                        && promo.getTargetProductId() != null) {
                    for (OrderItemDTO item : request.getItems()) {
                        if (promo.getTargetProductId().equals(item.getProductId())) {
                            discountAmount += item.getPrice() * item.getQuantity() * pct;
                        }
                    }
                } else if (promo.getAppliesTo() == Promotion.AppliesTo.CATEGORY) {
                    discountAmount = subtotal * pct;
                }
                discountAmount = BigDecimal.valueOf(discountAmount).setScale(2, RoundingMode.HALF_UP).doubleValue();
                appliedPromoCode = promo.getCode() != null ? promo.getCode().trim() : promo.getTitle();
            }
        }

        double totalAmount = BigDecimal.valueOf(Math.max(0, subtotal - discountAmount))
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();

        Order order = new Order();
        order.setUser(user);
        order.setOrderItems(orderItems);
        order.setTotalAmount(totalAmount);
        order.setDiscountAmount(discountAmount);
        order.setPromoCode(appliedPromoCode);
        order.setOrderDate(Instant.now());
        order.setStatus("Pending");
        order.setDeliveryAddress(request.getDeliveryAddress());
        order.setDeliveryLat(request.getDeliveryLat());
        order.setDeliveryLon(request.getDeliveryLon());
        order.setPaymentId(request.getPaymentId());
        order.setPayerId(request.getPayerId());

        // Set tenant from context and compute platform commission fee
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            tenantRepository.findById(tenantId).ifPresent(tenant -> {
                order.setTenant(tenant);
                if (tenant.getPlatformCommissionPercent() != null) {
                    double fee = BigDecimal.valueOf(totalAmount)
                            .multiply(tenant.getPlatformCommissionPercent())
                            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                            .doubleValue();
                    order.setPlatformFee(fee);
                }
            });
        }

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

        String storeName = saved.getTenant() != null ? saved.getTenant().getName() : "Our Store";
        emailService.sendOrderConfirmation(user.getEmail(), dto, storeName);

        return dto;
    }

    public List<OrderDTO> getOrdersByUser(UUID userId) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<Order> orders = (tenantId != null)
                ? orderRepository.findByUserIdAndTenant_Id(userId, tenantId)
                : orderRepository.findByUserId(userId);
        return orders.stream().map(this::convertToOrderDTO).toList();
    }

    public List<OrderDTO> getAllOrders() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<Order> orders;
        if (tenantId != null) {
            orders = orderRepository.findByTenant_Id(tenantId);
        } else {
            orders = orderRepository.findAll();
        }
        return orders.stream().map(this::convertToOrderDTO).toList();
    }

    public OrderDTO getOrderById(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        return convertToOrderDTO(order);
    }

    @Transactional
    public void deleteOrder(UUID orderId) {
        if (!orderRepository.existsById(orderId)) {
            throw new RuntimeException("Order not found");
        }
        orderRepository.deleteById(orderId);
    }

    public List<OrderDTO> getOrdersByStatus(String status) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<Order> orders = (tenantId != null)
                ? orderRepository.findByStatusAndTenant_Id(status, tenantId)
                : orderRepository.findByStatus(status);
        return orders.stream().map(this::convertToOrderDTO).toList();
    }

    public Page<OrderDTO> getPaginatedOrders(int page, int size, String sortBy) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        PageRequest pageable = PageRequest.of(page, size, Sort.by(sortBy));
        Page<Order> orders = (tenantId != null)
                ? orderRepository.findByTenant_Id(tenantId, pageable)
                : orderRepository.findAll(pageable);
        return orders.map(this::convertToOrderDTO);
    }

    public Page<OrderDTO> searchOrders(String query, int page, int size) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        PageRequest pageable = PageRequest.of(page, size, Sort.by("orderDate"));
        Page<Order> orders;
        if (tenantId != null) {
            orders = (query == null || query.isBlank())
                    ? orderRepository.findByTenant_Id(tenantId, pageable)
                    : orderRepository.findByUserEmailContainingIgnoreCaseAndTenant_Id(query, tenantId, pageable);
        } else {
            orders = (query == null || query.isBlank())
                    ? orderRepository.findAll(pageable)
                    : orderRepository.findByUserEmailContainingIgnoreCase(query, pageable);
        }
        return orders.map(this::convertToOrderDTO);
    }

    @Transactional
    public OrderDTO updateOrderStatus(UUID orderId, String status) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        boolean isCancelling = ("Cancelled".equals(status) || "Rejected".equals(status))
                && !"Cancelled".equals(order.getStatus())
                && !"Rejected".equals(order.getStatus());

        if (isCancelling) {
            UUID tenantId = TenantContext.getCurrentTenantId();
            for (OrderItem oi : order.getOrderItems()) {
                MenuItem menuItem = oi.getMenuItem();
                if (menuItem == null) continue;
                // Only restore stock if it was being tracked
                if (menuItem.getStock() >= 0) {
                    menuItem.setStock(menuItem.getStock() + oi.getQuantity());
                    menuItem.setReservedStock(Math.max(0, menuItem.getReservedStock() - oi.getQuantity()));
                    menuItemRepository.save(menuItem);

                    InventoryLog log = new InventoryLog();
                    log.setMenuItem(menuItem);
                    log.setStockChange(oi.getQuantity());
                    log.setReservedChange(-oi.getQuantity());
                    log.setType("ORDER_CANCELLED");
                    if (tenantId != null) {
                        tenantRepository.findById(tenantId).ifPresent(log::setTenant);
                    }
                    inventoryLogRepository.save(log);
                }
            }
        }

        order.setStatus(status);
        Order updated = orderRepository.save(order);
        OrderDTO dto = convertToOrderDTO(updated);

        // Push real-time status update to the customer
        String customerId = updated.getUser().getId().toString();
        messagingTemplate.convertAndSend("/topic/orders/" + customerId, dto);

        if ("Delivered".equals(status)) {
            String storeName = updated.getTenant() != null ? updated.getTenant().getName() : "Our Store";
            emailService.sendOrderDelivered(updated.getUser().getEmail(), dto, storeName);
        }

        return dto;
    }

    public List<User> getAvailableDrivers() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            return userRepository.findByRoleAndTenant_Id(Role.DRIVER, tenantId);
        }
        return userRepository.findByRole(Role.DRIVER);
    }

    @Transactional
    public OrderDTO assignDriverToOrder(UUID orderId, UUID driverId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        User driver = userRepository.findById(driverId)
                .orElseThrow(() -> new RuntimeException("Driver not found"));

        if (driver.getRole() != Role.DRIVER) {
            throw new RuntimeException("User is not a driver");
        }

        order.setDriver(driver);
        order.setStatus("Out for Delivery");

        Order updated = orderRepository.save(order);
        OrderDTO dto = convertToOrderDTO(updated);
        messagingTemplate.convertAndSend("/topic/orders/" + updated.getUser().getId(), dto);
        return dto;
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
                null, // driverName, set below
                order.getTenant() != null ? order.getTenant().getId() : null,
                order.getDiscountAmount() != null ? order.getDiscountAmount() : 0.0,
                order.getPromoCode(),
                order.getDeliveryLat(),
                order.getDeliveryLon()
        );

        if (order.getDriver() != null) {
            dto.setDriverName(order.getDriver().getEmail());
        }

        return dto;
    }

    public long getTotalOrders() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            return orderRepository.findByTenant_Id(tenantId).size();
        }
        return orderRepository.count();
    }

    public double getTotalRevenue() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<Order> orders;
        if (tenantId != null) {
            orders = orderRepository.findByTenant_Id(tenantId);
        } else {
            orders = orderRepository.findAll();
        }
        return orders.stream().mapToDouble(Order::getTotalAmount).sum();
    }

    public long getPendingOrdersCount() {
        return getAllOrders().stream()
                .filter(o -> "Pending".equals(o.getStatus()))
                .count();
    }
}
