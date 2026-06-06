package com.example.backend.repository;

import com.example.backend.entity.PayoutLedgerEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.UUID;

@Repository
public interface PayoutLedgerRepository extends JpaRepository<PayoutLedgerEntry, UUID> {

    Page<PayoutLedgerEntry> findByTenant_IdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);

    @Query("SELECT COALESCE(SUM(CASE WHEN e.entryType = 'CREDIT' THEN e.amountRand " +
           "WHEN e.entryType IN ('DEBIT','FEE','PAYOUT') THEN -e.amountRand ELSE 0 END), 0) " +
           "FROM PayoutLedgerEntry e WHERE e.tenant.id = :tenantId")
    BigDecimal computeBalance(@Param("tenantId") UUID tenantId);
}
