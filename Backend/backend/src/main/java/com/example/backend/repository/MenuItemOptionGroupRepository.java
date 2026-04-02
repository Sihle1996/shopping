package com.example.backend.repository;

import com.example.backend.entity.MenuItemOptionGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MenuItemOptionGroupRepository extends JpaRepository<MenuItemOptionGroup, UUID> {
    List<MenuItemOptionGroup> findByMenuItem_IdOrderBySortOrderAsc(UUID menuItemId);
    void deleteByMenuItem_Id(UUID menuItemId);
}
