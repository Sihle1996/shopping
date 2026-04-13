package com.example.backend.repository;


import com.example.backend.entity.MenuItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MenuItemRepository extends JpaRepository<MenuItem, UUID> {
    List<MenuItem> findByTenant_Id(UUID tenantId);
    long countByTenant_Id(UUID tenantId);
    java.util.Optional<MenuItem> findByIdAndTenant_Id(UUID id, UUID tenantId);
    List<MenuItem> findByIdInAndTenant_Id(List<UUID> ids, UUID tenantId);
}
