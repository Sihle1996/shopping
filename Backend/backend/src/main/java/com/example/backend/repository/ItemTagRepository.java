package com.example.backend.repository;

import com.example.backend.entity.ItemTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public interface ItemTagRepository extends JpaRepository<ItemTag, UUID> {

    List<ItemTag> findByMenuItem_Id(UUID menuItemId);

    List<ItemTag> findByTenant_Id(UUID tenantId);

    @Query("SELECT t.menuItem.id FROM ItemTag t WHERE t.tenant.id = :tenantId AND t.tag IN :tags")
    Set<UUID> findMenuItemIdsByTenantAndTags(@Param("tenantId") UUID tenantId, @Param("tags") List<String> tags);

    @Query("SELECT t.menuItem.id FROM ItemTag t WHERE t.tenant.id = :tenantId AND t.tag IN :tags")
    Set<UUID> findMenuItemIdsByTenantAndExcludedTags(@Param("tenantId") UUID tenantId, @Param("tags") List<String> tags);

    @Modifying
    @Query("DELETE FROM ItemTag t WHERE t.menuItem.id = :menuItemId")
    void deleteByMenuItem_Id(@Param("menuItemId") UUID menuItemId);

    boolean existsByMenuItem_Id(UUID menuItemId);

    boolean existsByMenuItem_IdAndTag(UUID menuItemId, String tag);
}
