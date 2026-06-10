package com.example.backend.repository;


import com.example.backend.entity.MenuItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MenuItemRepository extends JpaRepository<MenuItem, UUID> {
    List<MenuItem> findByTenant_Id(UUID tenantId);
    long countByTenant_Id(UUID tenantId);
    java.util.Optional<MenuItem> findByIdAndTenant_Id(UUID id, UUID tenantId);
    List<MenuItem> findByIdInAndTenant_Id(List<UUID> ids, UUID tenantId);

    /**
     * Atomically reserve stock IFF enough is free — the DB enforces the constraint in one statement,
     * closing the read-check-write race that could oversell the last unit(s) under concurrent checkout.
     * Returns 1 if reserved, 0 if there wasn't enough free stock. Caller must NOT also mutate the entity's
     * reservedStock (that would dirty-flush and double-count).
     */
    @Modifying
    @Query("UPDATE MenuItem m SET m.reservedStock = m.reservedStock + :qty " +
           "WHERE m.id = :id AND (m.stock - m.reservedStock) >= :qty")
    int tryReserveStock(@Param("id") UUID id, @Param("qty") int qty);

    /** Current free stock (stock − reserved) read fresh from the DB — for an accurate sold-out message. */
    @Query("SELECT m.stock - m.reservedStock FROM MenuItem m WHERE m.id = :id")
    Integer freeStock(@Param("id") UUID id);
}
