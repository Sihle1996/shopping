package com.example.backend.repository;

import com.example.backend.entity.Payout;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PayoutRepository extends JpaRepository<Payout, UUID> {
    List<Payout> findByTenant_IdOrderByCreatedAtDesc(UUID tenantId);
    List<Payout> findAllByOrderByCreatedAtDesc();
}
