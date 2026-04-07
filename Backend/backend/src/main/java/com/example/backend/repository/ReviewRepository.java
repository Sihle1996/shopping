package com.example.backend.repository;

import com.example.backend.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
