package com.example.backend.repository;

import com.example.backend.entity.DriverLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface DriverLedgerRepository extends JpaRepository<DriverLedgerEntry, UUID> {

    List<DriverLedgerEntry> findByDriver_IdOrderByCreatedAtDesc(UUID driverId);

    // Owed balance: EARNING + TIP accrue, PAYOUT settles them.
    @Query("SELECT COALESCE(SUM(CASE WHEN e.entryType IN ('EARNING','TIP') THEN e.amountRand " +
           "WHEN e.entryType = 'PAYOUT' THEN -e.amountRand ELSE 0 END), 0) " +
           "FROM DriverLedgerEntry e WHERE e.driver.id = :driverId")
    BigDecimal computeBalance(@Param("driverId") UUID driverId);

    // Lifetime gross earnings (base + tips), excluding settlements — what the driver has earned.
    @Query("SELECT COALESCE(SUM(e.amountRand), 0) FROM DriverLedgerEntry e " +
           "WHERE e.driver.id = :driverId AND e.entryType IN ('EARNING','TIP')")
    BigDecimal sumEarnings(@Param("driverId") UUID driverId);

    @Query("SELECT COALESCE(SUM(e.amountRand), 0) FROM DriverLedgerEntry e " +
           "WHERE e.driver.id = :driverId AND e.entryType IN ('EARNING','TIP') " +
           "AND e.createdAt >= :start AND e.createdAt < :end")
    BigDecimal sumEarningsInPeriod(@Param("driverId") UUID driverId,
                                   @Param("start") Instant start, @Param("end") Instant end);
}
