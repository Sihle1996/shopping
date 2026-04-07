package com.example.backend.repository;

import com.example.backend.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CategoryRepository extends JpaRepository<Category, UUID> {
    List<Category> findByTenant_Id(UUID tenantId);
    boolean existsByNameAndTenant_Id(String name, UUID tenantId);
    java.util.Optional<Category> findByIdAndTenant_Id(UUID id, UUID tenantId);
}
