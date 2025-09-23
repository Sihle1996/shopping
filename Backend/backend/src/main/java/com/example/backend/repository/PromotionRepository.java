package com.example.backend.repository;

import com.example.backend.model.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {

    @Query("SELECT p FROM Promotion p WHERE p.active = true AND p.startAt <= :now AND p.endAt >= :now ORDER BY p.featured DESC, p.startAt DESC")
    List<Promotion> findActive(@Param("now") OffsetDateTime now);

    Optional<Promotion> findFirstByFeaturedTrueAndActiveTrueAndStartAtBeforeAndEndAtAfter(OffsetDateTime now1, OffsetDateTime now2);

    Optional<Promotion> findByCodeAndActiveTrue(String code);
}
