package com.example.backend.controller;

import com.example.backend.entity.OrderDTO;
import com.example.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/orders")
@RequiredArgsConstructor
public class AdminOrderController {

    private final OrderService orderService;

    // ✅ Fetch All Orders (Admin)
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<?> getAllOrders() {
        try {
            List<OrderDTO> orders = orderService.getAllOrders();
            return ResponseEntity.ok(orders);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Error fetching orders: " + e.getMessage());
        }
    }

    // ✅ Fetch Order by ID (Admin)
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<?> getOrderById(@PathVariable Long id) {
        try {
            OrderDTO orderDTO = orderService.getOrderById(id);
            return ResponseEntity.ok(orderDTO);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body("Order not found.");
        }
    }

    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAdminStats() {
        try {
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalOrders", orderService.getTotalOrders());
            stats.put("totalRevenue", orderService.getTotalRevenue());
            stats.put("pendingOrders", orderService.getPendingOrdersCount());
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error fetching stats");
        }
    }


    // ✅ Fetch Orders by Status (Admin)
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/status/{status}")
    public ResponseEntity<?> getOrdersByStatus(@PathVariable String status) {
        try {
            List<OrderDTO> orders = orderService.getOrdersByStatus(status);
            return ResponseEntity.ok(orders);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error fetching orders: " + e.getMessage());
        }
    }

    // ✅ Paginated Orders (Admin)
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/page")
    public ResponseEntity<?> getPaginatedOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "orderDate") String sortBy
    ) {
        try {
            return ResponseEntity.ok(orderService.getPaginatedOrders(page, size, sortBy));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error fetching paginated orders: " + e.getMessage());
        }
    }

    // ✅ Update Order Status (Admin)
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/update/{orderId}")
    public ResponseEntity<?> updateOrderStatus(@PathVariable Long orderId, @RequestParam String status) {
        try {
            OrderDTO updatedOrder = orderService.updateOrderStatus(orderId, status);
            return ResponseEntity.ok(updatedOrder);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body("Order not found.");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("An error occurred while updating the order status.");
        }
    }

    // ✅ Delete Order (Admin)
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/delete/{orderId}")
    public ResponseEntity<?> deleteOrder(@PathVariable Long orderId) {
        try {
            orderService.deleteOrder(orderId);
            return ResponseEntity.ok("Order deleted successfully.");
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body("Order not found.");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("An error occurred while deleting the order.");
        }
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/available-drivers")
    public ResponseEntity<?> getAvailableDrivers() {
        return ResponseEntity.ok(orderService.getAvailableDrivers());
    }

    @PostMapping("/{orderId}/assign-driver")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> assignDriverToOrder(
            @PathVariable Long orderId,
            @RequestParam Long driverId) {
        try {
            OrderDTO updated = orderService.assignDriverToOrder(orderId, driverId);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            e.printStackTrace(); // 👈 Logs the real reason
            return ResponseEntity.status(400).body(e.getMessage()); // 👈 sends readable error to frontend
        }
    }

}
