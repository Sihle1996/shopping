package com.example.backend.repository;

import com.example.backend.entity.UserEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserEventRepository extends JpaRepository<UserEvent, UUID> {

    @Query("SELECT e.menuItem.id FROM UserEvent e WHERE e.user.id = :userId AND e.eventType = 'ORDER' ORDER BY e.createdAt DESC LIMIT 20")
    List<UUID> findRecentOrderedItemIds(@Param("userId") UUID userId);

    @Query("SELECT e.menuItem.id FROM UserEvent e WHERE e.user.id = :userId AND e.tenant.id = :tenantId AND e.eventType IN ('ADD_TO_CART','ORDER') ORDER BY e.createdAt DESC LIMIT 10")
    List<UUID> findRecentCartItemIds(@Param("userId") UUID userId, @Param("tenantId") UUID tenantId);
}
