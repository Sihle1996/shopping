package com.example.backend.controller;

import com.example.backend.entity.Order;
import com.example.backend.entity.Review;
import com.example.backend.repository.OrderRepository;
import com.example.backend.repository.ReviewRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewRepository reviewRepository;
    private final OrderRepository orderRepository;
    private final TenantRepository tenantRepository;

    /** Public: get all reviews for the current store */
    @GetMapping("/api/reviews")
    public ResponseEntity<?> getReviews() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();

        List<Review> reviews = reviewRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId);
        List<Map<String, Object>> result = reviews.stream().map(r -> {
            String name = r.getUser() != null && r.getUser().getFullName() != null
                    ? r.getUser().getFullName()
                    : "Guest";
            return Map.<String, Object>of(
                    "id", r.getId(),
                    "rating", r.getRating(),
                    "comment", r.getComment() != null ? r.getComment() : "",
                    "userName", name,
                    "createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : ""
            );
        }).collect(Collectors.toList());

        OptionalDouble avg = reviews.stream().mapToInt(Review::getRating).average();
        return ResponseEntity.ok(Map.of(
                "reviews", result,
                "averageRating", avg.isPresent() ? Math.round(avg.getAsDouble() * 10.0) / 10.0 : 0,
                "totalReviews", reviews.size()
        ));
    }

    /** Authenticated user submits a review for their own delivered order */
    @PostMapping("/api/reviews/order/{orderId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> submitReview(
            @PathVariable UUID orderId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {

        if (reviewRepository.existsByOrder_Id(orderId)) {
            return ResponseEntity.badRequest().body("You have already reviewed this order.");
        }

        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) return ResponseEntity.notFound().build();
        if (order.getUser() == null || !order.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Not your order.");
        }
        if (!"Delivered".equals(order.getStatus())) {
            return ResponseEntity.badRequest().body("You can only review delivered orders.");
        }

        int rating = Integer.parseInt(body.get("rating").toString());
        if (rating < 1 || rating > 5) return ResponseEntity.badRequest().body("Rating must be 1–5.");

        Review review = new Review();
        review.setOrder(order);
        review.setUser(user);
        review.setRating(rating);
        review.setComment(body.get("comment") != null ? body.get("comment").toString() : null);
        if (order.getTenant() != null) review.setTenant(order.getTenant());

        reviewRepository.save(review);
        return ResponseEntity.ok(Map.of("message", "Review submitted. Thank you!"));
    }

    /** Admin: list all reviews for their store */
    @GetMapping("/api/admin/reviews")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminReviews() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        List<Review> reviews = reviewRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId);
        List<Map<String, Object>> result = reviews.stream().map(r -> {
            String name = r.getUser() != null && r.getUser().getFullName() != null
                    ? r.getUser().getFullName()
                    : "Guest";
            return Map.<String, Object>of(
                    "id", r.getId(),
                    "rating", r.getRating(),
                    "comment", r.getComment() != null ? r.getComment() : "",
                    "userName", name,
                    "createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : ""
            );
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /** Admin: delete a review */
    @DeleteMapping("/api/admin/reviews/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteReview(@PathVariable UUID id) {
        if (!reviewRepository.existsById(id)) return ResponseEntity.notFound().build();
        reviewRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Review deleted."));
    }
}
