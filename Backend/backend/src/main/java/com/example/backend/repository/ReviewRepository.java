package com.example.backend.repository;

import com.example.backend.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReviewRepository extends JpaRepository<Review, UUID> {
    List<Review> findByTenant_IdOrderByCreatedAtDesc(UUID tenantId);
    Optional<Review> findByOrder_Id(UUID orderId);
    boolean existsByOrder_Id(UUID orderId);
    Optional<Review> findByIdAndTenant_Id(UUID id, UUID tenantId);

    /** Order IDs the given customer has already reviewed — drives the "Leave a review" gating. */
    @Query("SELECT r.order.id FROM Review r WHERE r.user.id = :userId")
    List<UUID> findReviewedOrderIdsByUserId(@Param("userId") UUID userId);
}
