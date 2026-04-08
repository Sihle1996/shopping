package com.example.backend.repository;

import com.example.backend.entity.InventoryLog;
import com.example.backend.entity.MenuItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface InventoryLogRepository extends JpaRepository<InventoryLog, UUID> {
    List<InventoryLog> findByTenant_Id(UUID tenantId);

    @Modifying
    @Query("UPDATE InventoryLog l SET l.menuItem = null WHERE l.menuItem = :menuItem")
    void nullifyMenuItemReference(@Param("menuItem") MenuItem menuItem);
}
