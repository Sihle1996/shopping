package com.example.backend.controller;

import com.example.backend.entity.StoreDocument;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.StoreDocumentRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.service.CloudinaryService;
import com.example.backend.service.EmailService;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/enrollment")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class StoreDocumentController {

    private final StoreDocumentRepository documentRepository;
    private final TenantRepository tenantRepository;
    private final CloudinaryService cloudinaryService;
    private final EmailService emailService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @GetMapping
    public ResponseEntity<?> listDocuments() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();
        List<StoreDocument> docs = documentRepository.findByTenantId(tenantId);
        return ResponseEntity.ok(Map.of(
                "approvalStatus", tenant.getApprovalStatus(),
                "rejectionReason", tenant.getRejectionReason() != null ? tenant.getRejectionReason() : "",
                "documents", docs
        ));
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam("documentType") String documentType) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();
        if (tenant.getApprovalStatus() == Tenant.ApprovalStatus.PENDING_REVIEW ||
                tenant.getApprovalStatus() == Tenant.ApprovalStatus.APPROVED) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot upload documents in current status"));
        }

        StoreDocument.DocumentType docType;
        try {
            docType = StoreDocument.DocumentType.valueOf(documentType.toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid document type"));
        }

        String url;
        try {
            url = cloudinaryService.upload(file);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Upload failed"));
        }

        StoreDocument doc = StoreDocument.builder()
                .tenant(tenant)
                .documentType(docType)
                .fileUrl(url)
                .fileName(file.getOriginalFilename())
                .status(StoreDocument.DocumentStatus.PENDING)
                .build();
        return ResponseEntity.ok(documentRepository.save(doc));
    }

    @DeleteMapping("/{docId}")
    @Transactional
    public ResponseEntity<?> deleteDocument(@PathVariable UUID docId) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();
        if (tenant.getApprovalStatus() == Tenant.ApprovalStatus.PENDING_REVIEW ||
                tenant.getApprovalStatus() == Tenant.ApprovalStatus.APPROVED) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete documents in current status"));
        }
        documentRepository.deleteByTenantIdAndId(tenantId, docId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/submit")
    @Transactional
    public ResponseEntity<?> submitForReview() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();

        List<StoreDocument> docs = documentRepository.findByTenantId(tenantId);
        boolean hasCipc = docs.stream().anyMatch(d -> d.getDocumentType() == StoreDocument.DocumentType.CIPC);
        boolean hasCoa = docs.stream().anyMatch(d -> d.getDocumentType() == StoreDocument.DocumentType.COA);
        boolean hasBank = docs.stream().anyMatch(d -> d.getDocumentType() == StoreDocument.DocumentType.BANK_DETAILS);
        if (!hasCipc || !hasCoa || !hasBank) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Please upload CIPC Certificate, Certificate of Acceptability, and Bank Details before submitting"));
        }

        tenant.setApprovalStatus(Tenant.ApprovalStatus.PENDING_REVIEW);
        tenant.setSubmittedForReviewAt(Instant.now());
        tenant.setRejectionReason(null);
        tenantRepository.save(tenant);

        emailService.sendDocumentsReceivedEmail(tenant.getName(), tenant.getEmail());

        return ResponseEntity.ok(Map.of("message", "Application submitted for review"));
    }
}
