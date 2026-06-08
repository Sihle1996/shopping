package com.example.backend.service;

import com.example.backend.entity.*;
import com.example.backend.repository.InventoryLogRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.TenantRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderAutoRejectService {

    private final OrderRepository orderRepository;
    private final MenuItemRepository menuItemRepository;
    private final InventoryLogRepository inventoryLogRepository;
    private final TenantRepository tenantRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final EmailService emailService;
    private final LoyaltyService loyaltyService;

    /** Fallback window when a store has no auto-cancel setting. */
    private static final int DEFAULT_AUTO_CANCEL_MINUTES = 15;

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void autoRejectTimedOutOrders() {
        Instant now = Instant.now();
        // All still-Pending orders; the cancel window is applied PER STORE (configurable).
        List<Order> pending = orderRepository.findByStatusAndOrderDateBefore("Pending", now);
        int cancelled = 0;

        for (Order order : pending) {
            Tenant tenant = order.getTenant();
            int minutes = (tenant != null && tenant.getAutoCancelMinutes() != null)
                    ? tenant.getAutoCancelMinutes() : DEFAULT_AUTO_CANCEL_MINUTES;
            if (minutes <= 0) continue;                                              // disabled for this store
            if (order.getOrderDate() == null
                    || order.getOrderDate().isAfter(now.minusSeconds(minutes * 60L))) continue; // not timed out yet

            releaseReservedStock(order);
            if (order.getUser() != null) {
                loyaltyService.refundPoints(order.getUser(), order);
            }

            order.setStatus("Cancelled");
            order.setCancellationReason("AUTO_TIMEOUT");
            orderRepository.save(order);

            messagingTemplate.convertAndSend("/topic/orders", Map.of(
                    "type", "ORDER_CANCELLED",
                    "orderId", order.getId().toString(),
                    "status", "Cancelled",
                    "reason", "AUTO_REJECTED_TIMEOUT"
            ));
            if (order.getUser() != null) {
                messagingTemplate.convertAndSend(
                        "/topic/orders/" + order.getUser().getId(),
                        Map.of("type", "ORDER_CANCELLED",
                               "orderId", order.getId().toString(),
                               "status", "Cancelled"));
            }

            String customerEmail = order.getUser() != null ? order.getUser().getEmail() : order.getGuestEmail();
            String storeName = order.getTenant() != null ? order.getTenant().getName() : "The restaurant";
            if (customerEmail != null && !customerEmail.isBlank()) {
                emailService.sendRaw(customerEmail,
                        "Order Cancelled — Restaurant Did Not Respond",
                        "<p>Hi,</p>" +
                        "<p>Your order <strong>#" + order.getId().toString().substring(0, 8) +
                        "</strong> from <strong>" + storeName +
                        "</strong> was automatically cancelled because the restaurant did not accept it within " +
                        minutes + " minutes.</p>" +
                        "<p>If you were charged, please contact the store and they'll assist with a refund.</p>" +
                        "<p>We apologise for the inconvenience.</p>");
            }

            log.info("Auto-rejected order {} — not accepted within {} minutes", order.getId(), minutes);
            cancelled++;
        }

        if (cancelled > 0) log.info("Auto-rejected {} timed-out orders", cancelled);
    }

    private void releaseReservedStock(Order order) {
        for (OrderItem oi : order.getOrderItems()) {
            MenuItem menuItem = oi.getMenuItem();
            if (menuItem == null) continue;
            if (menuItem.getStock() >= 0) {
                menuItem.setReservedStock(Math.max(0, menuItem.getReservedStock() - oi.getQuantity()));
                menuItemRepository.save(menuItem);

                InventoryLog log = new InventoryLog();
                log.setMenuItem(menuItem);
                log.setStockChange(0);
                log.setReservedChange(-oi.getQuantity());
                log.setType("ORDER_AUTO_REJECTED");
                if (order.getTenant() != null) {
                    log.setTenant(order.getTenant());
                }
                inventoryLogRepository.save(log);
            }
        }
    }
}
