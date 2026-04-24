package com.example.backend.repository;

import com.example.backend.entity.Favourite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FavouriteRepository extends JpaRepository<Favourite, UUID> {
    List<Favourite> findByUser_IdAndTenant_IdOrderByCreatedAtDesc(UUID userId, UUID tenantId);
    boolean existsByUser_IdAndMenuItem_Id(UUID userId, UUID menuItemId);
    void deleteByUser_IdAndMenuItem_Id(UUID userId, UUID menuItemId);
}
