package com.example.backend.repository;

import com.example.backend.entity.GroupCart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupCartRepository extends JpaRepository<GroupCart, UUID> {
    Optional<GroupCart> findByToken(String token);
}
