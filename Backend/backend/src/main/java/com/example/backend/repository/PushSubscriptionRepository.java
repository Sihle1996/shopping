package com.example.backend.repository;

import com.example.backend.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {
    List<PushSubscription> findByUser_Id(UUID userId);
    Optional<PushSubscription> findByUser_IdAndEndpoint(UUID userId, String endpoint);
    void deleteByEndpoint(String endpoint);
}
