package com.example.backend.controller;

import com.example.backend.entity.Expense;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.ExpenseRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.service.BookkeepingService;
import com.example.backend.service.SubscriptionEnforcementService;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * CraveIt Books — admin-only, PRO-gated accounting view.
 * Exposes the income statement ("money-in") plus operating-expense management.
 */
@RestController
@RequestMapping("/api/admin/books")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminBooksController {

    /** Default window (days) — matches {@link BookkeepingService#DEFAULT_WINDOW_DAYS}; annotation defaults must be string literals. */
    private static final String DEFAULT_DAYS = "30";

    private final BookkeepingService bookkeepingService;
    private final SubscriptionEnforcementService subscriptionEnforcementService;
    private final ExpenseRepository expenseRepository;
    private final TenantRepository tenantRepository;

    @GetMapping("/money-in")
    public ResponseEntity<BookkeepingService.MoneyIn> moneyIn(
            @RequestParam(defaultValue = DEFAULT_DAYS) int days) {
        UUID tenantId = requireBooksAccess();
        return ResponseEntity.ok(bookkeepingService.moneyIn(tenantId, days));
    }

    // ── Operating expenses ──────────────────────────────────────────────────

    @GetMapping("/expenses")
    public ResponseEntity<List<Expense>> listExpenses() {
        UUID tenantId = requireBooksAccess();
        return ResponseEntity.ok(expenseRepository.findByTenant_IdOrderByIncurredOnDesc(tenantId));
    }

    @PostMapping("/expenses")
    public ResponseEntity<Expense> addExpense(@RequestBody ExpenseRequest req) {
        UUID tenantId = requireBooksAccess();
        if (req.label() == null || req.label().isBlank() || req.amount() == null || req.amount() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Label and a positive amount are required.");
        }
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));
        Expense e = new Expense();
        e.setLabel(req.label().trim());
        e.setCategory(req.category() != null && !req.category().isBlank() ? req.category().trim() : "Other");
        e.setAmount(req.amount());
        e.setRecurring(Boolean.TRUE.equals(req.recurring()));
        e.setIncurredOn(req.incurredOn() != null ? req.incurredOn() : LocalDate.now());
        e.setTenant(tenant);
        return ResponseEntity.ok(expenseRepository.save(e));
    }

    @DeleteMapping("/expenses/{id}")
    public ResponseEntity<Void> deleteExpense(@PathVariable UUID id) {
        UUID tenantId = requireBooksAccess();
        Expense e = expenseRepository.findByIdAndTenant_Id(id, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Expense not found"));
        expenseRepository.delete(e);
        return ResponseEntity.noContent().build();
    }

    /** Resolve the tenant and assert the plan includes Books (PRO+). */
    private UUID requireBooksAccess() {
        UUID tenantId = TenantContext.getCurrentTenantId();
        subscriptionEnforcementService.assertAnalyticsAccess(tenantId);
        return tenantId;
    }

    /** Create/update payload for an expense. */
    public record ExpenseRequest(String label, String category, Double amount,
                                 Boolean recurring, LocalDate incurredOn) {}
}
