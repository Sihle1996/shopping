package com.example.backend.repository;

import com.example.backend.entity.LoyaltyAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LoyaltyAccountRepository extends JpaRepository<LoyaltyAccount, UUID> {
    Optional<LoyaltyAccount> findByUser_IdAndTenant_Id(UUID userId, UUID tenantId);
    List<LoyaltyAccount> findByUser_Id(UUID userId);
}
