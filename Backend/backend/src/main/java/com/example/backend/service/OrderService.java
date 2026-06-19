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

import com.example.backend.service.SubscriptionEnforcementService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
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
    private final PayFastService payFastService;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final DeliveryFeeService deliveryFeeService;
    private final WebPushService webPushService;
    private final PayoutLedgerService payoutLedgerService;
    private final AuditService auditService;
    private final com.example.backend.repository.RecommendationDecisionRepository recommendationDecisionRepository;
    private final com.example.backend.repository.GroupCartRepository groupCartRepository;

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
            // The REAL menu item is server-side truth for price, name and availability. The client's
            // "price" is IGNORED — it could send R5 for an R89 item and be charged R5.
            MenuItem menuItem = menuItemRepository.findById(itemDTO.getProductId())
                    .orElseThrow(() -> new RuntimeException("Menu item not found: " + itemDTO.getProductId()));

            if (Boolean.FALSE.equals(menuItem.getIsAvailable())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        menuItem.getName() + " is no longer available");
            }
            UUID ctxTenant = TenantContext.getCurrentTenantId();
            if (ctxTenant != null && (menuItem.getTenant() == null || !menuItem.getTenant().getId().equals(ctxTenant)))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        menuItem.getName() + " isn't on this store's menu");
            if (itemDTO.getQuantity() < 1 || itemDTO.getQuantity() > 99)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid quantity");

            OrderItem item = new OrderItem();
            item.setName(menuItem.getName());
            item.setQuantity(itemDTO.getQuantity());
            item.setSize(itemDTO.getSize());
            item.setSpecialInstructions(itemDTO.getSpecialInstructions());

            // Snapshot selected modifier choices — price EACH from the server's real option choice
            // (matched by group + label), never the client's number. An unknown choice prices at 0, so a
            // client can't fabricate an extra; legitimate negative options (removals) are honoured.
            double modSum = 0;
            if (itemDTO.getSelectedChoices() != null) {
                for (OrderItemDTO.SelectedChoiceDTO sc : itemDTO.getSelectedChoices()) {
                    double mod = menuItem.modifierFor(sc.getGroupName(), sc.getChoiceLabel());
                    modSum += mod;
                    OrderItemChoice choice = new OrderItemChoice();
                    choice.setOrderItem(item);
                    choice.setGroupName(sc.getGroupName());
                    choice.setChoiceLabel(sc.getChoiceLabel());
                    choice.setPriceModifier(mod);
                    item.getChoices().add(choice);
                }
            }
            // SERVER-authoritative line total: real menu price + additive modifiers, never the client's price.
            item.setTotalPrice((menuItem.getPrice() + modSum) * itemDTO.getQuantity());

            // Reserve stock atomically (don't deduct yet — deducted when the order is confirmed via ITN).
            // A read-check-write here would oversell the last unit under concurrent checkout; the DB
            // enforces "enough free stock" in one statement. stock < 0 means unlimited (no reservation).
            // NOTE: tryReserveStock writes reserved_stock directly — do NOT also set it on the managed
            // entity, or Hibernate's dirty-check would flush it again at commit and double-count.
            if (menuItem.getStock() >= 0) {
                int reserved = menuItemRepository.tryReserveStock(menuItem.getId(), itemDTO.getQuantity());
                if (reserved == 0) {
                    Integer free = menuItemRepository.freeStock(menuItem.getId()); // fresh from DB
                    int freeNow = free != null ? free : 0;
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            freeNow <= 0
                                    ? menuItem.getName() + " just sold out"
                                    : "Only " + freeNow + " of " + menuItem.getName() + " left in stock");
                }
            }
            checkLowStock(menuItem);

            InventoryLog log = new InventoryLog();
            log.setMenuItem(menuItem);
            log.setStockChange(0);
            log.setReservedChange(itemDTO.getQuantity());
            log.setType("ORDER_RESERVED");
            UUID logTenantId = TenantContext.getCurrentTenantId();
            if (logTenantId != null) {
                tenantRepository.findById(logTenantId).ifPresent(log::setTenant);
            }
            inventoryLogRepository.save(log);

            item.setMenuItem(menuItem);
            orderItems.add(item);
        }

        double calculatedSubtotal = 0;
        for (OrderItem oi : orderItems) {
            calculatedSubtotal += oi.getTotalPrice();
        }
        double subtotal = BigDecimal.valueOf(calculatedSubtotal)
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
        boolean freeDelivery = false;
        Promotion.PromoType appliedPromoType = null; // V52 capture — frozen at assignment
        UUID appliedPromoId = null;                  // V53 — stable attribution anchor

        java.util.Optional<Promotion> promoOpt = (request.getPromoCode() != null && !request.getPromoCode().isBlank())
                ? promotionService.validateCode(request.getPromoCode())
                : promotionService.findBestAutoAppliedPromo();

        if (promoOpt.isPresent()) {
            Promotion promo = promoOpt.get();
            Promotion.PromoType promoType = promo.getType() != null ? promo.getType() : Promotion.PromoType.PERCENT_OFF;
            // Spend-threshold gate — the reward only applies once the subtotal reaches minSpend.
            boolean qualifies = promo.getMinSpend() == null || subtotal >= promo.getMinSpend().doubleValue();
            boolean applied;
            if (qualifies && promoType == Promotion.PromoType.FREE_DELIVERY) {
                freeDelivery = true;
            } else if (qualifies && promoType == Promotion.PromoType.AMOUNT_OFF && promo.getDiscountAmount() != null) {
                discountAmount = Math.min(promo.getDiscountAmount().doubleValue(), subtotal);
            } else if (qualifies && promo.getDiscountPercent() != null) {
                double pct = promo.getDiscountPercent().doubleValue() / 100.0;
                if (promo.getAppliesTo() == Promotion.AppliesTo.ALL) {
                    discountAmount = subtotal * pct;
                } else if (promo.getAppliesTo() == Promotion.AppliesTo.PRODUCT
                        && promo.getTargetProductId() != null) {
                    // Discount off the SERVER line total (oi.getTotalPrice()), never the client's
                    // item.price — otherwise a forged high price inflates the % discount and zeroes
                    // the order total.
                    for (OrderItem oi : orderItems) {
                        if (oi.getMenuItem() != null && promo.getTargetProductId().equals(oi.getMenuItem().getId())) {
                            discountAmount += oi.getTotalPrice() * pct;
                        }
                    }
                } else if (promo.getAppliesTo() == Promotion.AppliesTo.CATEGORY
                        && promo.getTargetCategoryName() != null) {
                    String targetCat = promo.getTargetCategoryName().toLowerCase();
                    for (OrderItem oi : orderItems) {
                        UUID pid = oi.getMenuItem() != null ? oi.getMenuItem().getId() : null;
                        String itemCat = productCategoryMap.getOrDefault(pid, "").toLowerCase();
                        if (itemCat.equals(targetCat)) {
                            discountAmount += oi.getTotalPrice() * pct;
                        }
                    }
                } else if (promo.getAppliesTo() == Promotion.AppliesTo.MULTI_PRODUCT
                        && promo.getTargetProducts() != null && !promo.getTargetProducts().isEmpty()) {
                    java.util.Set<UUID> targetIds = promo.getTargetProducts().stream()
                            .map(com.example.backend.entity.MenuItem::getId)
                            .collect(java.util.stream.Collectors.toSet());
                    for (OrderItem oi : orderItems) {
                        if (oi.getMenuItem() != null && targetIds.contains(oi.getMenuItem().getId())) {
                            discountAmount += oi.getTotalPrice() * pct;
                        }
                    }
                }
            }
            // A discount can never exceed the server-computed subtotal (defense in depth).
            discountAmount = Math.min(discountAmount, subtotal);
            // A promo counts as applied only if it conferred value (a discount or free delivery);
            // a scoped promo that matched nothing in the cart must not tag the order.
            applied = freeDelivery || discountAmount > 0;
            if (applied) {
                discountAmount = BigDecimal.valueOf(discountAmount).setScale(2, RoundingMode.HALF_UP).doubleValue();
                appliedPromoCode = promo.getCode() != null ? promo.getCode().trim() : promo.getTitle();
                appliedPromoType = promoType;
                appliedPromoId = promo.getId();
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
        order.setOrderDate(Instant.now());
        if (request.getScheduledDeliveryTime() != null && !request.getScheduledDeliveryTime().isBlank()) {
            Instant scheduled = Instant.parse(request.getScheduledDeliveryTime());
            if (scheduled.isBefore(Instant.now().plusSeconds(900))) {
                throw new IllegalStateException("Scheduled delivery time must be at least 15 minutes in the future.");
            }
            order.setScheduledDeliveryTime(scheduled);
            order.setStatus("Scheduled");
        } else {
            order.setStatus("Pending");
        }
        order.setDeliveryAddress(request.getDeliveryAddress());
        order.setDeliveryLat(request.getDeliveryLat());
        order.setDeliveryLon(request.getDeliveryLon());
        order.setPaymentId(request.getPaymentId());
        order.setPayerId(request.getPayerId());
        String notes = request.getOrderNotes();
        if (notes != null && notes.length() > 500) notes = notes.substring(0, 500);
        order.setOrderNotes(notes);

        // Group-order attribution — preserve the link to the originating group cart (capture only;
        // not yet wired into any scoring). participantCount = distinct people who added items.
        String groupToken = request.getGroupCartToken();
        if (groupToken != null && !groupToken.isBlank()) {
            UUID currentTenant = TenantContext.getCurrentTenantId();
            groupCartRepository.findByToken(groupToken.trim()).ifPresent(gc -> {
                if (gc.getTenant() == null || currentTenant == null || gc.getTenant().getId().equals(currentTenant)) {
                    order.setGroupCartId(gc.getId());
                    order.setGroupOrder(true);
                    long participants = gc.getItems() == null ? 0 : gc.getItems().stream()
                            .map(i -> i.getAddedBy() != null ? i.getAddedBy().getId() : null)
                            .filter(java.util.Objects::nonNull).distinct().count();
                    order.setGroupParticipantCount((int) participants);
                    // Close the cart atomically with the order so it can't be orphaned (left OPEN
                    // and re-checked-out) if the client's separate close() call fails or is skipped.
                    if (!"CHECKED_OUT".equals(gc.getStatus())) {
                        gc.setStatus("CHECKED_OUT");
                        groupCartRepository.save(gc);
                    }
                }
            });
        }

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
                // A store must be APPROVED and active (not archived) to take NEW orders. Approval is the
                // real gate — checking active alone isn't enough since the two columns can diverge.
                // In-flight orders still complete via the store/driver flow; this guards new ones only.
                if (tenant.getApprovalStatus() != Tenant.ApprovalStatus.APPROVED
                        || !tenant.isActive() || tenant.isArchived()) {
                    throw new IllegalStateException("This store is not currently accepting orders.");
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
                // SERVER-authoritative delivery fee — recomputed from the store/delivery coordinates via
                // the same service the quote endpoint uses, so displayed == charged. The client's submitted
                // deliveryFee is IGNORED (a distant customer could otherwise submit baseFee and skip the
                // distance premium — the fee is platform revenue funding the drivers).
                order.setDeliveryFee(deliveryFeeService
                        .compute(tenant, request.getDeliveryLat(), request.getDeliveryLon()).fee());
                if (tenant.getPlatformCommissionPercent() != null) {
                    double fee = BigDecimal.valueOf(totalAmount)
                            .multiply(tenant.getPlatformCommissionPercent())
                            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                            .doubleValue();
                    order.setPlatformFee(fee);
                }
            });
        }

        // V52/V53 — capture promo economics (id, type, who funded it, the platform-waived fee) and
        // waive the free-delivery fee. Centralized so future promo types can't silently skip capture.
        applyPromoSnapshot(order, appliedPromoId, appliedPromoType, freeDelivery);

        for (OrderItem item : orderItems) {
            item.setOrder(order);
        }

        Order saved = orderRepository.save(order);
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
        String logoUrl = saved.getTenant() != null ? saved.getTenant().getLogoUrl() : null;
        String primaryColor = saved.getTenant() != null ? saved.getTenant().getPrimaryColor() : null;
        if (recipientEmail != null && !recipientEmail.isBlank()) {
            emailService.sendOrderConfirmation(recipientEmail, dto, storeName, logoUrl, primaryColor);
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

    /** Count of Pending orders still AWAITING PAYMENT for the current tenant — drives the new-order chime
     *  resume after a refresh. Paid orders are settled, so they no longer ring (the chime stops once paid). */
    public long countPendingForCurrentTenant() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return 0;
        return orderRepository.findByStatusAndTenant_IdOrderByOrderDateDesc("Pending", tenantId)
                .stream().filter(o -> !o.isPaid()).count();
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

    public OrderDTO getOrderById(UUID orderId, User caller) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Order order;
        if (tenantId != null) {
            // Store-scoped read (admin) — only orders belonging to the caller's store.
            order = orderRepository.findByIdAndTenant_Id(orderId, tenantId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        } else {
            // Customer-facing read — the caller may only see their OWN order (no cross-customer IDOR).
            order = orderRepository.findById(orderId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
            boolean owns = caller != null && order.getUser() != null
                    && order.getUser().getId().equals(caller.getId());
            if (!owns) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
            }
        }
        return convertToOrderDTO(order);
    }

    @Transactional
    public void deleteOrder(UUID orderId) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Order order = (tenantId != null
                ? orderRepository.findByIdAndTenant_Id(orderId, tenantId)
                : orderRepository.findById(orderId))
                .orElseThrow(() -> new RuntimeException("Order not found"));
        orderRepository.delete(order);
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
    /** Reserved-only states: stock is held (reserved) but not yet removed from inventory. */
    private boolean isReservedOnly(String s) {
        return "Pending".equals(s) || "Scheduled".equals(s);
    }

    /** V52 — freeze per-order promo economics at assignment: which lever applied, who funded it, and
     *  (for FREE_DELIVERY only) the delivery fee the platform waived — snapshotted BEFORE zeroing.
     *  Single capture point so new promo types can't silently skip it. */
    private void applyPromoSnapshot(Order order, UUID promoId, Promotion.PromoType type, boolean freeDelivery) {
        if (type != null) {
            order.setPromoId(promoId);
            order.setPromoType(type.name());
            order.setPromoFundedBy(type == Promotion.PromoType.FREE_DELIVERY ? "PLATFORM" : "STORE");
        }
        if (freeDelivery) {
            Double originalFee = order.getDeliveryFee();   // snapshot before mutation
            order.setWaivedDeliveryFee(originalFee);        // NULL unless FREE_DELIVERY; never 0.0-for-N/A
            order.setDeliveryFee(0.0);
        }
    }

    /** Consumed states: the order is active/fulfilled, so its stock has been deducted. */
    private boolean isConsumedStatus(String s) {
        return "Confirmed".equals(s) || "Preparing".equals(s)
                || "Out for Delivery".equals(s) || "Delivered".equals(s);
    }

    private static final double EWMA_ALPHA = 0.25;     // weight on the latest delivery
    private static final long   ONTIME_GRACE_MIN = 15; // leeway over the promised window

    /** O(1) update of the driver's recency-weighted on-time score when a delivery completes. */
    public void recordDeliveryPerformance(Order order) {
        if (order == null || order.getDriver() == null) return;
        User driver = order.getDriver();
        boolean onTime = wasOnTime(order);
        Double cur = driver.getDeliveryScoreEwma();
        double next = (cur == null) ? (onTime ? 1.0 : 0.0)
                : EWMA_ALPHA * (onTime ? 1.0 : 0.0) + (1 - EWMA_ALPHA) * cur;
        driver.setDeliveryScoreEwma(Math.round(next * 1000.0) / 1000.0);
        driver.setDeliveryScoreSamples((driver.getDeliveryScoreSamples() == null ? 0 : driver.getDeliveryScoreSamples()) + 1);
        userRepository.save(driver);

        // Fill the recommendation-decision outcome for this order (driver leg + on-time).
        try {
            recommendationDecisionRepository.findByOrderId(order.getId()).ifPresent(dec -> {
                if (order.getOutForDeliveryAt() != null && order.getDeliveredAt() != null) {
                    dec.setDriverLegMinutes((int) Duration.between(order.getOutForDeliveryAt(), order.getDeliveredAt()).toMinutes());
                }
                dec.setOnTime(onTime);
                dec.setDeliveredAt(order.getDeliveredAt() != null ? order.getDeliveredAt() : Instant.now());
                recommendationDecisionRepository.save(dec);
            });
        } catch (Exception ignored) { /* outcome capture must not break delivery */ }
    }

    /** Upsert the per-order recommendation decision: what was recommended vs what was assigned. */
    private void recordRecommendationDecision(UUID tenantId, UUID orderId, UUID recommendedDriverId,
                                              Double score, UUID assignedDriverId) {
        try {
            com.example.backend.entity.RecommendationDecision dec = recommendationDecisionRepository
                    .findByOrderId(orderId).orElseGet(com.example.backend.entity.RecommendationDecision::new);
            dec.setTenantId(tenantId);
            dec.setOrderId(orderId);
            dec.setRecommendedDriverId(recommendedDriverId);
            dec.setRecommendationScore(score);
            dec.setAssignedDriverId(assignedDriverId);
            dec.setAccepted(recommendedDriverId != null && recommendedDriverId.equals(assignedDriverId));
            if (dec.getCreatedAt() == null) dec.setCreatedAt(Instant.now());
            recommendationDecisionRepository.save(dec);
        } catch (Exception ignored) { /* never break assignment because we couldn't log the decision */ }
    }

    /** Did the DRIVER deliver within the promised window (+grace)? Measures the dispatch->delivered
     *  leg (outForDeliveryAt) so kitchen/admin delay doesn't count against the driver; falls back to
     *  order placement for older orders without a dispatch timestamp. Benchmarked against the
     *  customer estimate / scheduled time, smoothed by the EWMA. */
    private boolean wasOnTime(Order order) {
        if (order.getDeliveredAt() == null) return true; // can't judge -> don't penalise
        Instant legStart = order.getOutForDeliveryAt() != null ? order.getOutForDeliveryAt() : order.getOrderDate();
        if (legStart == null) return true;
        long actualMin = Duration.between(legStart, order.getDeliveredAt()).toMinutes();
        long promisedMin;
        if (order.getScheduledDeliveryTime() != null && order.getOrderDate() != null) {
            promisedMin = Math.max(0, Duration.between(order.getOrderDate(), order.getScheduledDeliveryTime()).toMinutes());
        } else {
            Integer est = order.getTenant() != null ? order.getTenant().getEstimatedDeliveryMinutes() : null;
            promisedMin = est != null ? est : 45;
        }
        return actualMin <= promisedMin + ONTIME_GRACE_MIN;
    }

    public OrderDTO updateOrderStatus(UUID orderId, String status) {
        return updateOrderStatus(orderId, status, null);
    }

    public OrderDTO updateOrderStatus(UUID orderId, String status, String cancelReason) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Order order = (tenantId != null)
                ? orderRepository.findByIdAndTenant_Id(orderId, tenantId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"))
                : orderRepository.findById(orderId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        // Idempotent: re-setting the same status is a no-op — never re-fire the delivered email,
        // payout debit, or stock side-effects.
        if (status != null && status.equals(order.getStatus())) {
            return convertToOrderDTO(order);
        }

        // Terminal orders are final — you can't un-deliver or un-cancel. Reject any change away
        // from a completed/cancelled/rejected state (the UI also hides these, this is the guard).
        String current = order.getStatus();
        if (current != null && !current.equals(status)
                && ("Delivered".equals(current) || "Cancelled".equals(current) || "Rejected".equals(current))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot change the status of a " + current + " order");
        }

        // Enforce the lifecycle state machine — no skipping straight to Delivered, no going
        // backward. An order must walk Preparing -> Out for Delivery -> Delivered.
        OrderStatus from = OrderStatus.fromLabel(current);
        OrderStatus to = OrderStatus.fromLabel(status);
        if (to == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown status: " + status);
        }
        if (from != null && from != to && !from.canTransitionTo(to)) {
            String allowed = from.nextStatuses().stream().map(OrderStatus::label)
                    .reduce((a, b) -> a + ", " + b).orElse("none");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Can't move a " + current + " order to " + status + ". Allowed next: " + allowed + ".");
        }

        // Payment gate: don't let an UNPAID order advance into fulfilment (a customer who abandoned
        // PayFast leaves a Pending order that looks identical to a paid one). Cancelling/Rejecting an
        // unpaid order is still allowed — only forward motion into prep/delivery is blocked.
        if (isReservedOnly(current) && isConsumedStatus(status) && !order.isPaid()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This order hasn't been paid yet — wait for payment confirmation before preparing it.");
        }

        // Can't deliver an order nobody is delivering. The canonical path is the driver confirming
        // with the customer's OTP; an admin marking it here is an explicit manual override.
        if ("Delivered".equals(status)) {
            if (order.getDriver() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Assign a driver before marking this order delivered.");
            }
            order.setDeliveredBy("ADMIN_OVERRIDE");
        }

        // Consume stock (deduct + release the reservation) the FIRST time an order leaves a
        // reserved-only state (Pending/Scheduled) for an active one (Confirmed/Preparing/Out for
        // Delivery/Delivered). The admin flow skips "Confirmed", so keying only on it left stock
        // reserved-but-never-deducted right through delivery.
        boolean isConsuming = isReservedOnly(order.getStatus()) && isConsumedStatus(status);
        if (isConsuming) {
            for (OrderItem oi : order.getOrderItems()) {
                MenuItem menuItem = oi.getMenuItem();
                if (menuItem == null) continue;
                if (menuItem.getStock() >= 0) {
                    menuItem.setStock(menuItem.getStock() - oi.getQuantity());
                    menuItem.setReservedStock(Math.max(0, menuItem.getReservedStock() - oi.getQuantity()));
                    menuItemRepository.save(menuItem);

                    InventoryLog log = new InventoryLog();
                    log.setMenuItem(menuItem);
                    log.setStockChange(-oi.getQuantity());
                    log.setReservedChange(-oi.getQuantity());
                    log.setType("ORDER_CONFIRMED");
                    if (tenantId != null) {
                        tenantRepository.findById(tenantId).ifPresent(log::setTenant);
                    }
                    inventoryLogRepository.save(log);
                }
            }
        }

        boolean isCancelling = ("Cancelled".equals(status) || "Rejected".equals(status))
                && !"Cancelled".equals(order.getStatus())
                && !"Rejected".equals(order.getStatus());

        if (isCancelling) {
            order.setCancellationReason(cancelReason != null && !cancelReason.isBlank()
                    ? cancelReason.trim() : "ADMIN_CANCELLED");
            // Mirror the consume rule: if the order's stock had been deducted (a consumed status),
            // restore it; if it was only reserved (Pending/Scheduled), release the reservation.
            boolean wasConsumed = isConsumedStatus(order.getStatus());
            for (OrderItem oi : order.getOrderItems()) {
                MenuItem menuItem = oi.getMenuItem();
                if (menuItem == null) continue;
                if (menuItem.getStock() >= 0) {
                    if (wasConsumed) {
                        // Stock was deducted when the order went active — restore it
                        menuItem.setStock(menuItem.getStock() + oi.getQuantity());
                    } else {
                        // Stock was only reserved — release reservation
                        menuItem.setReservedStock(Math.max(0, menuItem.getReservedStock() - oi.getQuantity()));
                    }
                    menuItemRepository.save(menuItem);

                    InventoryLog log = new InventoryLog();
                    log.setMenuItem(menuItem);
                    log.setStockChange(wasConsumed ? oi.getQuantity() : 0);
                    log.setReservedChange(wasConsumed ? 0 : -oi.getQuantity());
                    log.setType("ORDER_CANCELLED");
                    if (tenantId != null) {
                        tenantRepository.findById(tenantId).ifPresent(log::setTenant);
                    }
                    inventoryLogRepository.save(log);
                }
            }
            if (wasConsumed) {
                payoutLedgerService.recordRefundDebit(order);
            }
        }

        order.setStatus(status);
        if ("Out for Delivery".equals(status) && order.getOutForDeliveryAt() == null) {
            order.setOutForDeliveryAt(Instant.now());
        }
        if ("Delivered".equals(status) && order.getDeliveredAt() == null) {
            order.setDeliveredAt(Instant.now());
        }
        Order updated = orderRepository.save(order);
        auditService.log(AuditService.ADMIN, "ORDER_STATUS_CHANGED", "ORDER", orderId,
                current + " → " + status
                        + (cancelReason != null && !cancelReason.isBlank() ? " (" + cancelReason.trim() + ")" : ""));
        if ("Delivered".equals(status)) recordDeliveryPerformance(updated);
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
        String logoUrl = updated.getTenant() != null ? updated.getTenant().getLogoUrl() : null;
        String primaryColor = updated.getTenant() != null ? updated.getTenant().getPrimaryColor() : null;
        String customerEmail = updated.getUser() != null ? updated.getUser().getEmail() : updated.getGuestEmail();

        if ("Delivered".equals(status)) {
            payoutLedgerService.recordOrderCredit(updated);
            if (updated.getUser() != null) {
                webPushService.sendToUser(updated.getUser().getId(),
                        "Order delivered! 🎉", "Your order from " + storeName + " has arrived. Enjoy!");
            }
            if (customerEmail != null && !customerEmail.isBlank()) {
                emailService.sendOrderDelivered(customerEmail, dto, storeName, logoUrl, primaryColor);
            }
        } else {
            if (updated.getUser() != null) {
                String pushBody = pushBodyForStatus(status, storeName);
                if (pushBody != null) webPushService.sendToUser(updated.getUser().getId(), storeName, pushBody);
            }
            if (customerEmail != null && !customerEmail.isBlank()) {
                emailService.sendOrderStatusUpdate(customerEmail, status, updated.getId().toString(), storeName, logoUrl, primaryColor);
            }
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

    public OrderDTO assignDriverToOrder(UUID orderId, UUID driverId) {
        return assignDriverToOrder(orderId, driverId, null, null);
    }

    @Transactional
    public OrderDTO assignDriverToOrder(UUID orderId, UUID driverId,
                                        UUID recommendedDriverId, Double recommendationScore) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        Order order = (tenantId != null
                ? orderRepository.findByIdAndTenant_Id(orderId, tenantId)
                : orderRepository.findById(orderId))
                .orElseThrow(() -> new RuntimeException("Order not found"));

        String currentStatus = order.getStatus();
        if ("Cancelled".equals(currentStatus) || "Rejected".equals(currentStatus) || "Delivered".equals(currentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot assign a driver to a " + currentStatus + " order");
        }
        // Don't dispatch a driver before the kitchen is working on the order — they'd idle at the
        // store. Allowed from Preparing (food being made) and Out for Delivery (reassignment).
        if (!"Preparing".equals(currentStatus) && !"Out for Delivery".equals(currentStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Move the order to Preparing before assigning a driver — otherwise the driver waits at the store.");
        }

        User driver = (tenantId != null
                ? userRepository.findByIdAndTenant_Id(driverId, tenantId)
                : userRepository.findById(driverId))
                .orElseThrow(() -> new RuntimeException("Driver not found"));

        if (driver.getRole() != Role.DRIVER) {
            throw new RuntimeException("User is not a driver");
        }

        order.setDriver(driver);
        order.setStatus("Out for Delivery");
        if (order.getOutForDeliveryAt() == null) order.setOutForDeliveryAt(Instant.now());

        Order updated = orderRepository.save(order);
        auditService.log(AuditService.ADMIN, "DRIVER_ASSIGNED", "ORDER", orderId,
                "Assigned " + (driver.getFullName() != null && !driver.getFullName().isBlank()
                        ? driver.getFullName() : driver.getEmail()));
        recordRecommendationDecision(tenantId, orderId, recommendedDriverId, recommendationScore, driverId);
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
                order.getScheduledDeliveryTime() != null ? order.getScheduledDeliveryTime().toString() : null,
                order.getDeliveredBy(),
                order.getCancellationReason(),
                order.isPaid()
        );

        if (order.getDriver() != null) {
            User driver = order.getDriver();
            dto.setDriverName(driver.getFullName() != null ? driver.getFullName() : driver.getEmail());
            dto.setDriverLat(driver.getLatitude());
            dto.setDriverLon(driver.getLongitude());
        }

        // Include the OTP ONLY for the customer (who has no tenant context) when it's active and
        // unexpired — never for the store admin or driver. If the driver could read the OTP they
        // could confirm delivery without the customer ever receiving it, defeating the whole point.
        if (order.getDeliveryOtp() != null
                && order.getOtpExpiresAt() != null
                && java.time.Instant.now().isBefore(order.getOtpExpiresAt())
                && TenantContext.getCurrentTenantId() == null) {
            dto.setDeliveryOtp(order.getDeliveryOtp());
        }

        if (order.getScheduledDeliveryTime() != null) {
            dto.setScheduledDeliveryTime(order.getScheduledDeliveryTime().toString());
        }

        return dto;
    }

    private String pushBodyForStatus(String status, String storeName) {
        return switch (status) {
            case "Confirmed"        -> "Your order has been confirmed! We're getting started.";
            case "Preparing"        -> "Your order is now being prepared.";
            case "Out for Delivery" -> "Your order is on its way! 🚴";
            case "Cancelled"        -> "Your order from " + storeName + " was cancelled.";
            case "Rejected"         -> "Your order was rejected. Please contact the store.";
            default -> null;
        };
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

    /** The dashboard "Live Orders" feed — IN-FLIGHT orders that still need action
     *  (Pending/Scheduled/Confirmed/Preparing/Out for Delivery), newest first. Terminal orders
     *  (Delivered/Cancelled/Rejected) are excluded so the feed is a live control surface, not history;
     *  a quiet store correctly shows an empty "all caught up" state rather than old delivered orders. */
    public List<OrderDTO> getRecentOrders(int limit) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<Order> orders = tenantId != null
                ? orderRepository.findByTenant_IdOrderByOrderDateDesc(tenantId)
                : orderRepository.findAll(Sort.by(Sort.Direction.DESC, "orderDate"));
        return orders.stream()
                .filter(o -> !isTerminalStatus(o.getStatus()))
                .limit(limit).map(this::convertToOrderDTO).toList();
    }

    private boolean isTerminalStatus(String status) {
        return "Delivered".equals(status) || "Cancelled".equals(status) || "Rejected".equals(status);
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

        // Pending orders only had stock reserved (not deducted) — release reservation
        UUID cancelTenantId = TenantContext.getCurrentTenantId();
        for (OrderItem item : order.getOrderItems()) {
            MenuItem menuItem = item.getMenuItem();
            if (menuItem != null) {
                menuItem.setReservedStock(Math.max(0, menuItem.getReservedStock() - item.getQuantity()));
                menuItemRepository.save(menuItem);

                InventoryLog log = new InventoryLog();
                log.setMenuItem(menuItem);
                log.setMenuItemNameSnapshot(menuItem.getName());
                log.setStockChange(0);
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
