package com.example.backend.repository;

import com.example.backend.entity.StoreHours;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StoreHoursRepository extends JpaRepository<StoreHours, UUID> {
    List<StoreHours> findByTenant_IdOrderByDayOfWeek(UUID tenantId);
    Optional<StoreHours> findByTenant_IdAndDayOfWeek(UUID tenantId, int dayOfWeek);
}
