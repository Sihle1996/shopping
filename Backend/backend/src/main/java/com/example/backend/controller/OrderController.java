package com.example.backend.controller;

import com.example.backend.entity.OrderDTO;
import com.example.backend.entity.OrderRequestDTO;
import com.example.backend.repository.OrderRepository;
import com.example.backend.service.OrderService;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;
    private final OrderRepository orderRepository;

    // Place an Order from checkout (supports both authenticated and guest users)
    @PostMapping("/place")
    public ResponseEntity<?> placeOrder(@AuthenticationPrincipal User authenticatedUser,
                                        @RequestBody OrderRequestDTO request) {
        // Guest orders allowed — authenticatedUser may be null
        try {
            OrderDTO orderDTO = orderService.placeOrderFromPayment(request, authenticatedUser);
            return ResponseEntity.ok(orderDTO);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(
                Map.of("error", e.getMessage())
            );
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(
                Map.of("error", "Failed to place order",
                       "message", e.getMessage() != null ? e.getMessage() : "Unknown error")
            );
        }
    }



    // ✅ Get all orders for logged-in user
    @GetMapping
    public ResponseEntity<?> getOrders(@AuthenticationPrincipal User authenticatedUser) {
        if (authenticatedUser == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }

        try {
            List<OrderDTO> orders = orderService.getOrdersByUser(authenticatedUser.getId());
            return ResponseEntity.ok(orders);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("An error occurred while fetching orders.");
        }
    }

    // ✅ Get order by ID
    @GetMapping("/{id}")
    public ResponseEntity<?> getOrderById(@PathVariable UUID id) {
        try {
            OrderDTO orderDTO = orderService.getOrderById(id);
            return ResponseEntity.ok(orderDTO);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body("Order not found.");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("An error occurred while fetching the order.");
        }
    }

    // ✅ Public order tracking (guest-friendly — requires email for guest orders)
    @GetMapping("/track/{orderId}")
    public ResponseEntity<?> trackOrder(@PathVariable UUID orderId,
                                         @RequestParam(required = false) String email) {
        var order = orderRepository.findById(orderId).orElse(null);
        if (order == null) return ResponseEntity.notFound().build();

        // Registered-user orders are not accessible publicly — use order history
        if (order.getGuestEmail() == null) {
            return ResponseEntity.status(403).body(Map.of("error", "This order requires login to view"));
        }

        // Guest orders require the guest's email for verification
        if (email == null || !email.equalsIgnoreCase(order.getGuestEmail())) {
            return ResponseEntity.status(403).body(Map.of("error", "Email address does not match"));
        }

        Map<String, Object> result = new HashMap<>();
        result.put("id", order.getId());
        result.put("status", order.getStatus());
        result.put("orderDate", order.getOrderDate());
        result.put("deliveryAddress", order.getDeliveryAddress());
        result.put("totalAmount", order.getTotalAmount());
        result.put("deliveryFee", order.getDeliveryFee() != null ? order.getDeliveryFee() : 0.0);
        result.put("items", order.getOrderItems().stream().map(i ->
            Map.of("name", i.getName(), "quantity", i.getQuantity())
        ).toList());
        return ResponseEntity.ok(result);
    }

    // ✅ Cancel a pending order (customer)
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<?> cancelOrder(@PathVariable UUID id,
                                         @AuthenticationPrincipal User authenticatedUser) {
        if (authenticatedUser == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        try {
            OrderDTO orderDTO = orderService.cancelOrder(id, authenticatedUser);
            return ResponseEntity.ok(orderDTO);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to cancel order"));
        }
    }
}
