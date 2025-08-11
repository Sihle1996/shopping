package com.example.backend.controller;

import com.example.backend.entity.OrderDTO;
import com.example.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/orders")
@RequiredArgsConstructor
@Slf4j
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
            log.error("Error fetching orders", e);
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
            log.error("Order not found for id {}", id, e);
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
            log.error("Error fetching stats", e);
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
            log.error("Error fetching orders with status {}", status, e);
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
            log.error("Error fetching paginated orders for page {}, size {}, sort {}", page, size, sortBy, e);
            return ResponseEntity.status(500).body("Error fetching paginated orders: " + e.getMessage());
        }
    }

    // ✅ Search Orders with Pagination (Admin)
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/search")
    public ResponseEntity<?> searchOrders(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        try {
            return ResponseEntity.ok(orderService.searchOrders(query, page, size));
        } catch (Exception e) {
            log.error("Error searching orders with query {}, page {}, size {}", query, page, size, e);
            return ResponseEntity.status(500).body("Error searching orders: " + e.getMessage());
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
            log.error("Order not found with id {}", orderId, e);
            return ResponseEntity.status(404).body("Order not found.");
        } catch (Exception e) {
            log.error("Error updating order {} status to {}", orderId, status, e);
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
            log.error("Order not found with id {}", orderId, e);
            return ResponseEntity.status(404).body("Order not found.");
        } catch (Exception e) {
            log.error("Error deleting order {}", orderId, e);
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
            log.error("Error assigning driver {} to order {}", driverId, orderId, e);
            return ResponseEntity.status(400).body(e.getMessage());
        }
    }

}
