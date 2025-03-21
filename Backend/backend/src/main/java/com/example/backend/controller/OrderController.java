package com.example.backend.controller;

import com.example.backend.entity.OrderDTO;
import com.example.backend.entity.OrderRequestDTO;
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

    // ✅ Place an Order from PayPal Checkout
    @PostMapping("/place")
    public ResponseEntity<?> placeOrder(@AuthenticationPrincipal User authenticatedUser,
                                        @RequestBody OrderRequestDTO request) {
        if (authenticatedUser == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }

        try {
            OrderDTO orderDTO = orderService.placeOrderFromPayment(request, authenticatedUser);
            return ResponseEntity.ok(orderDTO);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("An error occurred while placing the order.");
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
