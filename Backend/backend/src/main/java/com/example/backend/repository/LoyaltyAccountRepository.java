package com.example.backend.repository;

import com.example.backend.entity.LoyaltyAccount;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LoyaltyAccountRepository extends JpaRepository<LoyaltyAccount, UUID> {
    Optional<LoyaltyAccount> findByUser_IdAndTenant_Id(UUID userId, UUID tenantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT la FROM LoyaltyAccount la WHERE la.user.id = :userId AND la.tenant.id = :tenantId")
    Optional<LoyaltyAccount> findByUser_IdAndTenant_IdForUpdate(UUID userId, UUID tenantId);

    List<LoyaltyAccount> findByUser_Id(UUID userId);
}
