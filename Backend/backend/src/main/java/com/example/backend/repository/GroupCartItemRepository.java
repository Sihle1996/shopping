package com.example.backend.repository;

import com.example.backend.entity.GroupCartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface GroupCartItemRepository extends JpaRepository<GroupCartItem, UUID> {
}
