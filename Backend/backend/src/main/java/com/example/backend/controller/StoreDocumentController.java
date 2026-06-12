package com.example.backend.controller;

import com.example.backend.entity.MenuItem;
import com.example.backend.entity.StoreDocument;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.CategoryRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.StoreDocumentRepository;
import com.example.backend.repository.StoreHoursRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.service.CloudinaryService;
import com.example.backend.service.EmailService;
import com.example.backend.user.Role;
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
import java.util.HashMap;
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
    private final MenuItemRepository menuItemRepository;
    private final CategoryRepository categoryRepository;
    private final CloudinaryService cloudinaryService;
    private final EmailService emailService;
    private final UserRepository userRepository;
    private final StoreHoursRepository storeHoursRepository;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @GetMapping
    public ResponseEntity<?> listDocuments() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();
        List<StoreDocument> docs = documentRepository.findByTenantId(tenantId);
        long menuItemCount = menuItemRepository.countByTenant_Id(tenantId);
        long categoryCount = categoryRepository.findByTenant_Id(tenantId).size();
        Map<String, Object> resp = new HashMap<>();
        resp.put("approvalStatus", tenant.getApprovalStatus());
        resp.put("rejectionReason", tenant.getRejectionReason() != null ? tenant.getRejectionReason() : "");
        resp.put("documents", docs);
        resp.put("cipcNumber", tenant.getCipcNumber() != null ? tenant.getCipcNumber() : "");
        resp.put("bankName", tenant.getBankName() != null ? tenant.getBankName() : "");
        resp.put("bankAccountNumber", tenant.getBankAccountNumber() != null ? tenant.getBankAccountNumber() : "");
        resp.put("bankAccountType", tenant.getBankAccountType() != null ? tenant.getBankAccountType() : "");
        resp.put("bankBranchCode", tenant.getBankBranchCode() != null ? tenant.getBankBranchCode() : "");
        resp.put("menuItemCount", menuItemCount);
        resp.put("categoryCount", categoryCount);
        resp.put("active", tenant.isActive());
        resp.put("bankingChangeStatus", tenant.getBankingChangeStatus() != null ? tenant.getBankingChangeStatus() : "");

        // --- Launch-scene fields + go-live readiness ---
        resp.put("name", tenant.getName());
        resp.put("cuisineType", tenant.getCuisineType());
        resp.put("logoUrl", tenant.getLogoUrl());
        resp.put("coverImageUrl", tenant.getCoverImageUrl());
        resp.put("primaryColor", tenant.getPrimaryColor());
        resp.put("storeDescription", tenant.getStoreDescription());
        long driverCount = userRepository.countByRoleAndTenant_Id(Role.DRIVER, tenantId);
        boolean hasHours = storeHoursRepository.findByTenant_IdOrderByDayOfWeek(tenantId)
                .stream().anyMatch(h -> !h.isClosed());
        resp.put("hasLocation", tenant.getLatitude() != null && tenant.getLongitude() != null);
        resp.put("hasDriver", driverCount > 0);
        resp.put("driverCount", driverCount);
        resp.put("hasHours", hasHours);
        resp.put("hasLogo", tenant.getLogoUrl() != null && !tenant.getLogoUrl().isBlank());
        List<Map<String, Object>> sampleMenuItems = new java.util.ArrayList<>();
        for (MenuItem mi : menuItemRepository.findByTenant_Id(tenantId)) {
            if (sampleMenuItems.size() >= 4) break;
            Map<String, Object> m = new HashMap<>();
            m.put("name", mi.getName());
            m.put("image", mi.getImage());
            sampleMenuItems.add(m);
        }
        resp.put("sampleMenuItems", sampleMenuItems);
        return ResponseEntity.ok(resp);
    }

    // An APPROVED store proposes a banking change. The new details are stored as PENDING and do NOT
    // replace the live bank fields until a Compliance super-admin approves the change — a banking change
    // is a high-risk event that must be re-reviewed, not freely editable and not permanently locked.
    @PostMapping("/request-bank-change")
    public ResponseEntity<?> requestBankChange(@RequestBody Map<String, String> body) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();
        if (tenant.getApprovalStatus() != Tenant.ApprovalStatus.APPROVED) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only an approved store can request a banking change"));
        }
        if (body.get("bankAccountNumber") == null || body.get("bankAccountNumber").isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "New bank account number is required"));
        }
        tenant.setPendingBankName(body.get("bankName"));
        tenant.setPendingBankAccountNumber(body.get("bankAccountNumber"));
        tenant.setPendingBankAccountType(body.get("bankAccountType"));
        tenant.setPendingBankBranchCode(body.get("bankBranchCode"));
        tenant.setBankingChangeStatus("PENDING");
        tenantRepository.save(tenant);
        return ResponseEntity.ok(Map.of("message", "Banking change submitted for review"));
    }

    @PutMapping("/details")
    @Transactional
    public ResponseEntity<?> saveDetails(@RequestBody Map<String, String> body) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();
        if (tenant.getApprovalStatus() == Tenant.ApprovalStatus.PENDING_REVIEW ||
                tenant.getApprovalStatus() == Tenant.ApprovalStatus.APPROVED) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot edit details in current status"));
        }
        if (body.containsKey("cipcNumber")) tenant.setCipcNumber(body.get("cipcNumber"));
        if (body.containsKey("bankName")) tenant.setBankName(body.get("bankName"));
        if (body.containsKey("bankAccountNumber")) tenant.setBankAccountNumber(body.get("bankAccountNumber"));
        if (body.containsKey("bankAccountType")) tenant.setBankAccountType(body.get("bankAccountType"));
        if (body.containsKey("bankBranchCode")) tenant.setBankBranchCode(body.get("bankBranchCode"));
        tenantRepository.save(tenant);
        return ResponseEntity.ok(Map.of("message", "Details saved"));
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

        if (tenant.getBankName() == null || tenant.getBankName().isBlank() ||
                tenant.getBankAccountNumber() == null || tenant.getBankAccountNumber().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Please fill in your bank account details before submitting"));
        }

        // A store can't deliver without a precise location — require address + map pin before review/go-live.
        if (tenant.getAddress() == null || tenant.getAddress().isBlank()
                || tenant.getLatitude() == null || tenant.getLongitude() == null) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Please set your store location (address + map pin) in Settings before submitting"));
        }

        tenant.setApprovalStatus(Tenant.ApprovalStatus.PENDING_REVIEW);
        tenant.setSubmittedForReviewAt(Instant.now());
        tenant.setRejectionReason(null);
        tenantRepository.save(tenant);

        emailService.sendDocumentsReceivedEmail(tenant.getName(), tenant.getEmail());

        return ResponseEntity.ok(Map.of("message", "Application submitted for review"));
    }

    @PostMapping("/go-live")
    @Transactional
    public ResponseEntity<?> goLive() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();

        if (tenant.getApprovalStatus() != Tenant.ApprovalStatus.APPROVED) {
            return ResponseEntity.badRequest().body(Map.of("error", "Store must be approved before going live"));
        }

        long categoryCount = categoryRepository.findByTenant_Id(tenantId).size();
        long menuItemCount = menuItemRepository.countByTenant_Id(tenantId);
        if (categoryCount == 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Add at least one menu category before going live"));
        }
        if (menuItemCount == 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Add at least one menu item before going live"));
        }
        if (tenant.getLatitude() == null || tenant.getLongitude() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Set your store location before going live"));
        }
        if (userRepository.countByRoleAndTenant_Id(Role.DRIVER, tenantId) == 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Add at least one delivery driver before going live"));
        }

        tenant.setActive(true);
        // Going live should also OPEN the store for orders, otherwise the owner sees
        // "Your store is now live!" yet customers get "currently closed" (B3). Manual
        // override is set so the hours scheduler doesn't immediately re-close it.
        tenant.setIsOpen(true);
        tenant.setManualOpenOverride(true);
        tenantRepository.save(tenant);
        return ResponseEntity.ok(Map.of("message", "Your store is now live!"));
    }
}
