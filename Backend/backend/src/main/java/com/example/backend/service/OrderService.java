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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.example.backend.service.LoyaltyService;
import com.example.backend.service.SubscriptionEnforcementService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
    private final LoyaltyService loyaltyService;
    private final PayFastService payFastService;
    private final SubscriptionEnforcementService subscriptionEnforcementService;

    private void checkLowStock(MenuItem menuItem) {
        if (menuItem.getStock() >= 0 && menuItem.getStock() <= menuItem.getLowStockThreshold()) {
            UUID tenantId = TenantContext.getCurrentTenantId();
            if (tenantId != null) {
                tenantRepository.findById(tenantId).ifPresent(tenant -> {
                    if (tenant.getEmail() != null && !tenant.getEmail().isBlank()) {
                        emailService.sendRaw(tenant.getEmail(),
                            "Low Stock Alert — " + menuItem.getName(),
                            "<p>Stock for <strong>" + menuItem.getName() + "</strong> has dropped to <strong>"
                            + menuItem.getStock() + "</strong> units (threshold: " + menuItem.getLowStockThreshold() + ").</p>"
                            + "<p>Please restock soon to avoid running out.</p>");
                    }
                });
            }
        }
    }

    @Transactional
    public OrderDTO placeOrderFromPayment(OrderRequestDTO request, User user) {
        List<OrderItem> orderItems = new ArrayList<>();

        for (OrderItemDTO itemDTO : request.getItems()) {
            OrderItem item = new OrderItem();
            item.setName(itemDTO.getName());
            item.setQuantity(itemDTO.getQuantity());
            item.setTotalPrice(itemDTO.getPrice() * itemDTO.getQuantity());
            item.setSize(itemDTO.getSize());
            item.setSpecialInstructions(itemDTO.getSpecialInstructions());

            // Snapshot selected modifier choices
            if (itemDTO.getSelectedChoices() != null) {
                for (OrderItemDTO.SelectedChoiceDTO sc : itemDTO.getSelectedChoices()) {
                    OrderItemChoice choice = new OrderItemChoice();
                    choice.setOrderItem(item);
                    choice.setGroupName(sc.getGroupName());
                    choice.setChoiceLabel(sc.getChoiceLabel());
                    choice.setPriceModifier(sc.getPriceModifier() != null ? sc.getPriceModifier() : 0.0);
                    item.getChoices().add(choice);
                }
            }

            MenuItem menuItem = menuItemRepository.findById(itemDTO.getProductId())
                    .orElseThrow(() -> new RuntimeException("Menu item not found: " + itemDTO.getProductId()));

            // Only adjust stock if it's being tracked (stock > 0)
            int newStock = menuItem.getStock() - itemDTO.getQuantity();
            if (newStock >= 0) {
                menuItem.setStock(newStock);
                menuItem.setReservedStock(menuItem.getReservedStock() + itemDTO.getQuantity());
            }
            menuItemRepository.save(menuItem);
            checkLowStock(menuItem);

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

        // Build a productId → category map from the already-resolved menu items
        java.util.Map<UUID, String> productCategoryMap = new java.util.HashMap<>();
        for (OrderItem orderItem : orderItems) {
            if (orderItem.getMenuItem() != null && orderItem.getMenuItem().getId() != null) {
                String cat = orderItem.getMenuItem().getCategory();
                productCategoryMap.put(orderItem.getMenuItem().getId(), cat != null ? cat : "");
            }
        }

        // Apply promotion discount server-side
        double discountAmount = 0.0;
        String appliedPromoCode = null;

        java.util.Optional<Promotion> promoOpt = (request.getPromoCode() != null && !request.getPromoCode().isBlank())
                ? promotionService.validateCode(request.getPromoCode())
                : promotionService.findBestAutoAppliedPromo();

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
                } else if (promo.getAppliesTo() == Promotion.AppliesTo.CATEGORY
                        && promo.getTargetCategoryName() != null) {
                    String targetCat = promo.getTargetCategoryName().toLowerCase();
                    for (OrderItemDTO item : request.getItems()) {
                        String itemCat = productCategoryMap.getOrDefault(item.getProductId(), "").toLowerCase();
                        if (itemCat.equals(targetCat)) {
                            discountAmount += item.getPrice() * item.getQuantity() * pct;
                        }
                    }
                } else if (promo.getAppliesTo() == Promotion.AppliesTo.MULTI_PRODUCT
                        && promo.getTargetProducts() != null && !promo.getTargetProducts().isEmpty()) {
                    java.util.Set<UUID> targetIds = promo.getTargetProducts().stream()
                            .map(com.example.backend.entity.MenuItem::getId)
                            .collect(java.util.stream.Collectors.toSet());
                    for (OrderItemDTO item : request.getItems()) {
                        if (targetIds.contains(item.getProductId())) {
                            discountAmount += item.getPrice() * item.getQuantity() * pct;
                        }
                    }
                }
                discountAmount = BigDecimal.valueOf(discountAmount).setScale(2, RoundingMode.HALF_UP).doubleValue();
                appliedPromoCode = promo.getCode() != null ? promo.getCode().trim() : promo.getTitle();
            }
        }

        // Apply loyalty points redemption (authenticated users only)
        if (user != null && request.getLoyaltyPointsRedeemed() > 0) {
            try {
                UUID loyaltyTenantId = TenantContext.getCurrentTenantId();
                if (loyaltyTenantId != null) {
                    double loyaltyDiscount = loyaltyService.redeemPoints(user, loyaltyTenantId, request.getLoyaltyPointsRedeemed());
                    discountAmount = BigDecimal.valueOf(discountAmount + loyaltyDiscount)
                            .setScale(2, RoundingMode.HALF_UP)
                            .doubleValue();
                }
            } catch (Exception ignored) {
                // redemption failure doesn't block order
            }
        }

        double totalAmount = BigDecimal.valueOf(Math.max(0, subtotal - discountAmount))
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();

        Order order = new Order();
        order.setUser(user); // null for guest orders
        if (user == null) {
            order.setGuestEmail(request.getGuestEmail());
            order.setGuestPhone(request.getGuestPhone());
        }
        order.setOrderItems(orderItems);
        order.setTotalAmount(totalAmount);
        order.setDiscountAmount(discountAmount);
        order.setPromoCode(appliedPromoCode);
        if (request.getLoyaltyPointsRedeemed() > 0) {
            order.setLoyaltyPointsRedeemed(request.getLoyaltyPointsRedeemed());
        }
        order.setOrderDate(Instant.now());
        if (request.getScheduledDeliveryTime() != null && !request.getScheduledDeliveryTime().isBlank()) {
            order.setScheduledDeliveryTime(Instant.parse(request.getScheduledDeliveryTime()));
            order.setStatus("Scheduled");
        } else {
            order.setStatus("Pending");
        }
        order.setDeliveryAddress(request.getDeliveryAddress());
        order.setDeliveryLat(request.getDeliveryLat());
        order.setDeliveryLon(request.getDeliveryLon());
        order.setPaymentId(request.getPaymentId());
        order.setPayerId(request.getPayerId());
        order.setOrderNotes(request.getOrderNotes());

        // Set tenant from context and compute platform commission fee
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId != null) {
            tenantRepository.findById(tenantId).ifPresent(tenant -> {
                // Enforce subscription delivery radius
                if (request.getDeliveryLat() != null && request.getDeliveryLon() != null
                        && tenant.getLatitude() != null && tenant.getLongitude() != null) {
                    double distKm = haversineKm(
                            tenant.getLatitude(), tenant.getLongitude(),
                            request.getDeliveryLat(), request.getDeliveryLon());
                    subscriptionEnforcementService.assertDeliveryRadius(tenant.getId(), distKm);
                }
                // Enforce store-closed check
                if (Boolean.FALSE.equals(tenant.getIsOpen())) {
                    throw new IllegalStateException("This store is currently closed and not accepting orders.");
                }
                // Enforce minimum order amount
                if (tenant.getMinimumOrderAmount() != null) {
                    BigDecimal min = tenant.getMinimumOrderAmount();
                    if (BigDecimal.valueOf(totalAmount).compareTo(min) < 0) {
                        throw new IllegalStateException(
                            "Minimum order amount is R" + min.setScale(2, RoundingMode.HALF_UP) +
                            ". Your order total is R" + BigDecimal.valueOf(totalAmount).setScale(2, RoundingMode.HALF_UP) + ".");
                    }
                }
                order.setTenant(tenant);
                // Set delivery fee from tenant's configured base fee (server-authoritative)
                if (tenant.getDeliveryFeeBase() != null) {
                    order.setDeliveryFee(tenant.getDeliveryFeeBase().doubleValue());
                } else {
                    order.setDeliveryFee(0.0);
                }
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
        // Loyalty points are awarded on delivery, not on placement
        OrderDTO dto = convertToOrderDTO(saved);

        if (user != null) {
            messagingTemplate.convertAndSendToUser(
                    String.valueOf(user.getId()),
                    "/queue/orders",
                    dto
            );
        }

        // Broadcast to admin notification feed
        String recipientEmail = user != null ? user.getEmail() : request.getGuestEmail();
        messagingTemplate.convertAndSend("/topic/orders", Map.of(
                "type", "ORDER_CREATED",
                "orderId", saved.getId().toString(),
                "userEmail", recipientEmail != null ? recipientEmail : "guest",
                "totalAmount", saved.getTotalAmount() != null ? saved.getTotalAmount() : BigDecimal.ZERO,
                "currency", "ZAR"
        ));

        String storeName = saved.getTenant() != null ? saved.getTenant().getName() : "Our Store";
        if (recipientEmail != null && !recipientEmail.isBlank()) {
            emailService.sendOrderConfirmation(recipientEmail, dto, storeName);
        }

        return dto;
    }

    public List<OrderDTO> getOrdersByUser(UUID userId) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<Order> orders = (tenantId != null)
                ? orderRepository.findByUserIdAndTenant_IdOrderByOrderDateDesc(userId, tenantId)
                : orderRepository.findByUserIdOrderByOrderDateDesc(userId);
        return orders.stream().map(this::convertToOrderDTO).toList();
    }

    public List<OrderDTO> getAllOrders() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<Order> orders;
        if (tenantId != null) {
            orders = orderRepository.findByTenant_IdOrderByOrderDateDesc(tenantId);
        } else {
            orders = orderRepository.findAll(Sort.by(Sort.Direction.DESC, "orderDate"));
        }
        return orders.stream().map(this::convertToOrderDTO).toList();
    }

    public OrderDTO getOrderById(UUID orderId) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Order order = (tenantId != null)
                ? orderRepository.findByIdAndTenant_Id(orderId, tenantId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"))
                : orderRepository.findById(orderId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
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
                ? orderRepository.findByStatusAndTenant_IdOrderByOrderDateDesc(status, tenantId)
                : orderRepository.findByStatusOrderByOrderDateDesc(status);
        return orders.stream().map(this::convertToOrderDTO).toList();
    }

    public Page<OrderDTO> getPaginatedOrders(int page, int size, String sortBy) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "orderDate"));
        Page<Order> orders = (tenantId != null)
                ? orderRepository.findByTenant_Id(tenantId, pageable)
                : orderRepository.findAll(pageable);
        return orders.map(this::convertToOrderDTO);
    }

    public Page<OrderDTO> searchOrders(String query, int page, int size) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "orderDate"));
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
        UUID tenantId = TenantContext.getCurrentTenantId();
        Order order = (tenantId != null)
                ? orderRepository.findByIdAndTenant_Id(orderId, tenantId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"))
                : orderRepository.findById(orderId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        boolean isCancelling = ("Cancelled".equals(status) || "Rejected".equals(status))
                && !"Cancelled".equals(order.getStatus())
                && !"Rejected".equals(order.getStatus());

        if (isCancelling) {
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
            // Refund any redeemed loyalty points
            if (order.getUser() != null) {
                loyaltyService.refundPoints(order.getUser(), order);
            }
        }

        order.setStatus(status);
        if ("Delivered".equals(status) && order.getDeliveredAt() == null) {
            order.setDeliveredAt(Instant.now());
        }
        Order updated = orderRepository.save(order);
        OrderDTO dto = convertToOrderDTO(updated);

        // Push real-time status update to the customer (only if authenticated user)
        if (updated.getUser() != null) {
            messagingTemplate.convertAndSend("/topic/orders/" + updated.getUser().getId(), dto);
        }
        // Broadcast to admin
        String eventType = ("Cancelled".equals(status) || "Rejected".equals(status)) ? "ORDER_CANCELLED" : "ORDER_UPDATED";
        messagingTemplate.convertAndSend("/topic/orders", Map.of(
                "type", eventType,
                "orderId", updated.getId().toString(),
                "status", updated.getStatus()
        ));

        String storeName = updated.getTenant() != null ? updated.getTenant().getName() : "Our Store";
        String customerEmail = updated.getUser() != null ? updated.getUser().getEmail() : updated.getGuestEmail();

        if ("Delivered".equals(status)) {
            if (updated.getUser() != null) {
                loyaltyService.awardPoints(updated.getUser(), updated);
            }
            if (customerEmail != null && !customerEmail.isBlank()) {
                emailService.sendOrderDelivered(customerEmail, dto, storeName);
            }
        } else if (customerEmail != null && !customerEmail.isBlank()) {
            // Send status update email for Confirmed, Preparing, Out for Delivery, Cancelled, Rejected
            emailService.sendOrderStatusUpdate(customerEmail, status, updated.getId().toString(), storeName);
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

        String currentStatus = order.getStatus();
        if ("Cancelled".equals(currentStatus) || "Rejected".equals(currentStatus) || "Delivered".equals(currentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot assign a driver to a " + currentStatus + " order");
        }

        User driver = userRepository.findById(driverId)
                .orElseThrow(() -> new RuntimeException("Driver not found"));

        if (driver.getRole() != Role.DRIVER) {
            throw new RuntimeException("User is not a driver");
        }

        order.setDriver(driver);
        order.setStatus("Out for Delivery");

        Order updated = orderRepository.save(order);
        OrderDTO dto = convertToOrderDTO(updated);
        if (updated.getUser() != null) {
            messagingTemplate.convertAndSend("/topic/orders/" + updated.getUser().getId(), dto);
        }
        // Broadcast driver assignment to admin
        messagingTemplate.convertAndSend("/topic/orders", Map.of(
                "type", "ORDER_ASSIGNED",
                "orderId", updated.getId().toString(),
                "status", updated.getStatus()
        ));
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
            if (item.getMenuItem() != null) dto.setProductId(item.getMenuItem().getId());
            dto.setSpecialInstructions(item.getSpecialInstructions());
            if (item.getChoices() != null && !item.getChoices().isEmpty()) {
                dto.setSelectedChoices(item.getChoices().stream().map(c -> {
                    OrderItemDTO.SelectedChoiceDTO sc = new OrderItemDTO.SelectedChoiceDTO();
                    sc.setGroupName(c.getGroupName());
                    sc.setChoiceLabel(c.getChoiceLabel());
                    sc.setPriceModifier(c.getPriceModifier());
                    return sc;
                }).toList());
            }
            return dto;
        }).toList();

        UUID userId = order.getUser() != null ? order.getUser().getId() : null;
        String userEmail = order.getUser() != null ? order.getUser().getEmail() : order.getGuestEmail();
        String userPhone = order.getUser() != null ? order.getUser().getPhone() : order.getGuestPhone();

        OrderDTO dto = new OrderDTO(
                order.getId(),
                order.getTotalAmount(),
                order.getStatus(),
                formattedDate,
                order.getDeliveryAddress(),
                userId,
                userEmail,
                order.getPaymentId(),
                order.getPayerId(),
                itemDTOs,
                null, // driverName, set below
                null, // driverLat, set below
                null, // driverLon, set below
                order.getTenant() != null ? order.getTenant().getId() : null,
                order.getDiscountAmount() != null ? order.getDiscountAmount() : 0.0,
                order.getDeliveryFee() != null ? order.getDeliveryFee() : 0.0,
                order.getPromoCode(),
                order.getDeliveryLat(),
                order.getDeliveryLon(),
                order.getOrderNotes(),
                userPhone,
                null,  // deliveryOtp — set below if active
                order.getScheduledDeliveryTime() != null ? order.getScheduledDeliveryTime().toString() : null
        );

        if (order.getDriver() != null) {
            User driver = order.getDriver();
            dto.setDriverName(driver.getFullName() != null ? driver.getFullName() : driver.getEmail());
            dto.setDriverLat(driver.getLatitude());
            dto.setDriverLon(driver.getLongitude());
        }

        // Include OTP for authenticated customers when it's active and not yet expired
        if (order.getDeliveryOtp() != null
                && order.getOtpExpiresAt() != null
                && java.time.Instant.now().isBefore(order.getOtpExpiresAt())) {
            dto.setDeliveryOtp(order.getDeliveryOtp());
        }

        if (order.getScheduledDeliveryTime() != null) {
            dto.setScheduledDeliveryTime(order.getScheduledDeliveryTime().toString());
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
        return orders.stream()
                .filter(o -> "Delivered".equals(o.getStatus()))
                .mapToDouble(Order::getTotalAmount).sum();
    }

    public long getPendingOrdersCount() {
        return getAllOrders().stream()
                .filter(o -> "Pending".equals(o.getStatus()))
                .count();
    }

    public long getTodayOrders() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Instant startOfDay = LocalDate.now(ZoneId.of("Africa/Johannesburg"))
                .atStartOfDay(ZoneId.of("Africa/Johannesburg")).toInstant();
        List<Order> orders = tenantId != null
                ? orderRepository.findByOrderDateBetweenAndTenant_Id(startOfDay, Instant.now(), tenantId)
                : orderRepository.findByOrderDateBetween(startOfDay, Instant.now());
        return orders.size();
    }

    public double getTodayRevenue() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Instant startOfDay = LocalDate.now(ZoneId.of("Africa/Johannesburg"))
                .atStartOfDay(ZoneId.of("Africa/Johannesburg")).toInstant();
        List<Order> orders = tenantId != null
                ? orderRepository.findByOrderDateBetweenAndTenant_Id(startOfDay, Instant.now(), tenantId)
                : orderRepository.findByOrderDateBetween(startOfDay, Instant.now());
        return orders.stream()
                .filter(o -> "Delivered".equals(o.getStatus()))
                .mapToDouble(Order::getTotalAmount).sum();
    }

    public List<OrderDTO> getRecentOrders(int limit) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<Order> orders = tenantId != null
                ? orderRepository.findByTenant_IdOrderByOrderDateDesc(tenantId)
                : orderRepository.findAll(Sort.by(Sort.Direction.DESC, "orderDate"));
        return orders.stream().limit(limit).map(this::convertToOrderDTO).toList();
    }

    @Transactional
    public OrderDTO cancelOrder(UUID orderId, User user) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));

        if (order.getUser() == null || !order.getUser().getId().equals(user.getId())) {
            throw new IllegalStateException("You are not authorized to cancel this order");
        }
        if (!"Pending".equals(order.getStatus())) {
            throw new IllegalStateException("Only pending orders can be cancelled");
        }

        // Restore stock and reserved stock for each item, and log the cancellation
        UUID cancelTenantId = TenantContext.getCurrentTenantId();
        for (OrderItem item : order.getOrderItems()) {
            MenuItem menuItem = item.getMenuItem();
            if (menuItem != null) {
                menuItem.setStock(menuItem.getStock() + item.getQuantity());
                menuItem.setReservedStock(Math.max(0, menuItem.getReservedStock() - item.getQuantity()));
                menuItemRepository.save(menuItem);

                InventoryLog log = new InventoryLog();
                log.setMenuItem(menuItem);
                log.setMenuItemNameSnapshot(menuItem.getName());
                log.setStockChange(item.getQuantity());
                log.setReservedChange(-item.getQuantity());
                log.setType("ORDER_CANCELLED");
                if (cancelTenantId != null) {
                    tenantRepository.findById(cancelTenantId).ifPresent(log::setTenant);
                }
                inventoryLogRepository.save(log);
            }
        }

        order.setStatus("Cancelled");
        orderRepository.save(order);

        // Broadcast cancellation to admin and customer in real time
        messagingTemplate.convertAndSend("/topic/orders", Map.of(
                "type", "ORDER_CANCELLED",
                "orderId", order.getId().toString(),
                "status", "Cancelled"
        ));
        if (order.getUser() != null) {
            messagingTemplate.convertAndSend("/topic/orders/" + order.getUser().getId(), Map.of(
                    "type", "ORDER_CANCELLED",
                    "orderId", order.getId().toString(),
                    "status", "Cancelled"
            ));
        }

        // Refund any redeemed loyalty points
        loyaltyService.refundPoints(order.getUser(), order);

        // PayFast refunds are handled manually via the PayFast merchant dashboard
        if (order.getPaymentId() != null && !order.getPaymentId().isBlank()) {
            System.out.println("Order " + orderId + " cancelled — PayFast payment " + order.getPaymentId()
                    + " should be refunded via the PayFast merchant dashboard.");
        }

        return convertToOrderDTO(order);
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
