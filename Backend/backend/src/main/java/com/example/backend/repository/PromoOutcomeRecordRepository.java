package com.example.backend.repository;

import com.example.backend.entity.PromoOutcomeRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PromoOutcomeRecordRepository extends JpaRepository<PromoOutcomeRecord, UUID> {

    List<PromoOutcomeRecord> findByTenantId(UUID tenantId);

    boolean existsByPromoId(UUID promoId);
}
