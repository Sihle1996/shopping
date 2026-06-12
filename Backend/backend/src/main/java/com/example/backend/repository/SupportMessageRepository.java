package com.example.backend.repository;

import com.example.backend.entity.SupportMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SupportMessageRepository extends JpaRepository<SupportMessage, UUID> {
    List<SupportMessage> findByTicket_IdOrderByCreatedAtAsc(UUID ticketId);
}
