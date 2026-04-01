package com.example.backend.repository;

import com.example.backend.model.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PromotionRepository extends JpaRepository<Promotion, UUID> {

    @Query("SELECT p FROM Promotion p WHERE p.active = true AND p.startAt <= :now AND p.endAt >= :now ORDER BY p.featured DESC, p.startAt DESC")
    List<Promotion> findActive(@Param("now") OffsetDateTime now);

    @Query("SELECT p FROM Promotion p WHERE p.active = true AND p.startAt <= :now AND p.endAt >= :now AND p.tenant.id = :tenantId ORDER BY p.featured DESC, p.startAt DESC")
    List<Promotion> findActiveByTenantId(@Param("now") OffsetDateTime now, @Param("tenantId") UUID tenantId);

    Optional<Promotion> findFirstByFeaturedTrueAndActiveTrueAndStartAtBeforeAndEndAtAfter(OffsetDateTime now1, OffsetDateTime now2);

    @Query("SELECT p FROM Promotion p WHERE p.featured = true AND p.active = true AND p.startAt <= :now AND p.endAt > :now AND p.tenant.id = :tenantId ORDER BY p.startAt DESC")
    Optional<Promotion> findFeaturedByTenantId(@Param("now") OffsetDateTime now, @Param("tenantId") UUID tenantId);

    Optional<Promotion> findByCodeAndActiveTrue(String code);

    List<Promotion> findByTenant_Id(UUID tenantId);

    Optional<Promotion> findByCodeAndActiveTrueAndTenant_Id(String code, UUID tenantId);
    long countByTenant_IdAndActiveTrue(UUID tenantId);
}
