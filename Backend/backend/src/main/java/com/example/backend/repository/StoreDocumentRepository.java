package com.example.backend.repository;

import com.example.backend.entity.StoreDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StoreDocumentRepository extends JpaRepository<StoreDocument, UUID> {
    List<StoreDocument> findByTenantId(UUID tenantId);
    void deleteByTenantIdAndId(UUID tenantId, UUID docId);
}
