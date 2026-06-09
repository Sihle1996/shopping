package com.example.backend.repository;

import com.example.backend.entity.RecommendationDecision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RecommendationDecisionRepository extends JpaRepository<RecommendationDecision, UUID> {
    Optional<RecommendationDecision> findByOrderId(UUID orderId);
    List<RecommendationDecision> findByTenantId(UUID tenantId);
}
