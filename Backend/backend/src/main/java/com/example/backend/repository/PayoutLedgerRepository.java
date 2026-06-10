package com.example.backend.repository;

import com.example.backend.entity.PayoutLedgerEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface PayoutLedgerRepository extends JpaRepository<PayoutLedgerEntry, UUID> {

    Page<PayoutLedgerEntry> findByTenant_IdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);

    @Query("SELECT COALESCE(SUM(CASE WHEN e.entryType = 'CREDIT' THEN e.amountRand " +
           "WHEN e.entryType IN ('DEBIT','FEE','PAYOUT') THEN -e.amountRand ELSE 0 END), 0) " +
           "FROM PayoutLedgerEntry e WHERE e.tenant.id = :tenantId")
    BigDecimal computeBalance(@Param("tenantId") UUID tenantId);

    // ---- payout generation: aggregate the ledger over a settlement period ----

    @Query("SELECT COALESCE(SUM(e.amountRand), 0) FROM PayoutLedgerEntry e " +
           "WHERE e.tenant.id = :tenantId AND e.entryType = :type " +
           "AND e.createdAt >= :start AND e.createdAt < :end")
    BigDecimal sumByTypeInPeriod(@Param("tenantId") UUID tenantId, @Param("type") String type,
                                 @Param("start") Instant start, @Param("end") Instant end);

    @Query("SELECT DISTINCT e.tenant.id FROM PayoutLedgerEntry e")
    List<UUID> findTenantIdsWithLedger();

    @Query("SELECT MIN(e.createdAt) FROM PayoutLedgerEntry e WHERE e.tenant.id = :tenantId")
    Instant earliestEntry(@Param("tenantId") UUID tenantId);
}
