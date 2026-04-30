package com.example.backend.repository;

import com.example.backend.entity.Combo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ComboRepository extends JpaRepository<Combo, UUID> {

    List<Combo> findByTenant_IdAndActiveTrue(UUID tenantId);

    List<Combo> findByTenant_Id(UUID tenantId);

    Optional<Combo> findByIdAndTenant_Id(UUID id, UUID tenantId);

    @Query("SELECT c FROM Combo c JOIN c.items ci WHERE ci.menuItem.id = :menuItemId AND c.tenant.id = :tenantId AND c.active = true")
    List<Combo> findActiveByMenuItemAndTenant(@Param("menuItemId") UUID menuItemId, @Param("tenantId") UUID tenantId);

    boolean existsByTenant_IdAndSource(UUID tenantId, String source);

    @Modifying
    @Query("DELETE FROM Combo c WHERE c.tenant.id = :tenantId AND c.source = 'SYSTEM'")
    void deleteSystemCombosByTenant(@Param("tenantId") UUID tenantId);
}
