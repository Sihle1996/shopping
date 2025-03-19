package com.example.backend.controller;


import com.example.backend.entity.OrderDTO;
import com.example.backend.service.OrderService;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderService orderService;

    // ✅ Place an Order
    @PostMapping("/place")
    public ResponseEntity<?> placeOrder(@AuthenticationPrincipal User authenticatedUser,
                                        @RequestBody Map<String, Object> payload) {
        if (authenticatedUser == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }

        try {
            List<Integer> cartItemIds = (List<Integer>) payload.get("cartItemIds");
            List<Long> convertedCartItemIds = cartItemIds.stream().map(Long::valueOf).toList();
            String deliveryAddress = (String) payload.get("deliveryAddress");

            OrderDTO orderDTO = orderService.placeOrder(authenticatedUser.getId(), convertedCartItemIds, deliveryAddress);
            return ResponseEntity.ok(orderDTO);
        } catch (ClassCastException e) {
            return ResponseEntity.badRequest().body("Invalid cart item IDs format.");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("An error occurred while placing the order.");
        }
    }

    // ✅ Get All Orders for Logged-in User
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

    // ✅ Get Order by ID
    @GetMapping("/{id}")
    public ResponseEntity<?> getOrderById(@PathVariable Long id) {
        try {
            OrderDTO orderDTO = orderService.getOrderById(id);
            return ResponseEntity.ok(orderDTO);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body("Order not found.");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("An error occurred while fetching the order.");
        }
    }
}
