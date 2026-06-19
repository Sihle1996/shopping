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
            String name = publicReviewerName(r.getUser());
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

    /** Privacy-safe public display name: "John D." — first name + last initial, never the full
     *  surname (the public store page must not leak customers' full names). */
    private String publicReviewerName(User user) {
        if (user == null || user.getFullName() == null || user.getFullName().isBlank()) return "Guest";
        String[] parts = user.getFullName().trim().split("\\s+");
        if (parts.length == 1) return parts[0];
        return parts[0] + " " + Character.toUpperCase(parts[parts.length - 1].charAt(0)) + ".";
    }

    /** Order IDs the signed-in customer has already reviewed — so the UI persists the "reviewed"
     *  state across reloads instead of relying on in-session memory. */
    @GetMapping("/api/reviews/my-order-ids")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> myReviewedOrderIds(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(reviewRepository.findReviewedOrderIdsByUserId(user.getId()));
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

        Object ratingRaw = body.get("rating");
        if (ratingRaw == null) return ResponseEntity.badRequest().body("Rating is required.");
        int rating;
        try {
            rating = Integer.parseInt(ratingRaw.toString().trim());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("Rating must be a whole number between 1 and 5.");
        }
        if (rating < 1 || rating > 5) return ResponseEntity.badRequest().body("Rating must be 1–5.");

        Review review = new Review();
        review.setOrder(order);
        review.setUser(user);
        review.setRating(rating);
        // Cap the free-text comment server-side so a hostile client can't store an unbounded blob.
        String comment = body.get("comment") != null ? body.get("comment").toString() : null;
        if (comment != null && comment.length() > 1000) comment = comment.substring(0, 1000);
        review.setComment(comment);
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
        UUID tenantId = TenantContext.getCurrentTenantId();
        // Never fall back to an unscoped global delete: without a tenant context there is no
        // store the caller is allowed to act on, so the review is simply "not found" for them.
        if (tenantId == null) return ResponseEntity.notFound().build();
        if (reviewRepository.findByIdAndTenant_Id(id, tenantId).isEmpty()) return ResponseEntity.notFound().build();
        reviewRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Review deleted."));
    }
}
