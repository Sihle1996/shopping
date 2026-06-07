package com.example.backend.controller;

import com.example.backend.entity.Expense;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.ExpenseRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.service.BookkeepingService;
import com.example.backend.service.SubscriptionEnforcementService;
import com.example.backend.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
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

    @GetMapping("/export.csv")
    public ResponseEntity<ByteArrayResource> exportCsv(@RequestParam(defaultValue = DEFAULT_DAYS) int days) {
        UUID tenantId = requireBooksAccess();
        BookkeepingService.MoneyIn pl = bookkeepingService.moneyIn(tenantId, days);

        StringBuilder sb = new StringBuilder();
        sb.append("CraveIt Books — Profit & Loss,last ").append(pl.days()).append(" days\n\n");
        sb.append("Line,Amount (ZAR)\n");
        sb.append("Revenue,").append(pl.revenue()).append('\n');
        sb.append("Food cost (COGS),-").append(pl.cogs()).append('\n');
        sb.append("Gross profit,").append(pl.grossProfit()).append('\n');
        sb.append("Platform commission,-").append(pl.platformCommission()).append('\n');
        sb.append("Net profit,").append(pl.netProfit()).append('\n');
        sb.append("Operating expenses,-").append(pl.operatingExpenses()).append('\n');
        sb.append("Operating profit,").append(pl.operatingProfit()).append('\n');

        sb.append("\nSales by category,Revenue,Cost,Margin %\n");
        for (BookkeepingService.CategoryLine c : pl.cogsByCategory()) {
            sb.append(csv(c.category)).append(',').append(c.getRevenue()).append(',')
              .append(c.getCogs()).append(',').append(c.getMarginPercent() != null ? c.getMarginPercent() : "").append('\n');
        }

        sb.append("\nProfit by item,Units,Revenue,Cost,Profit,Margin %\n");
        for (BookkeepingService.ItemLine it : pl.items()) {
            sb.append(csv(it.name)).append(',').append(it.units).append(',').append(it.getRevenue()).append(',')
              .append(it.getCogs()).append(',').append(it.getProfit()).append(',')
              .append(it.getMarginPercent() != null ? it.getMarginPercent() : "").append('\n');
        }

        sb.append("\nOperating expenses,Category,Amount,Type,Date\n");
        for (Expense e : expenseRepository.findByTenant_IdOrderByIncurredOnDesc(tenantId)) {
            sb.append(csv(e.getLabel())).append(',').append(csv(e.getCategory())).append(',')
              .append(e.getAmount()).append(',').append(e.isRecurring() ? "monthly" : "one-off")
              .append(',').append(e.getIncurredOn()).append('\n');
        }

        byte[] bytes = sb.toString().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=craveit-books-" + pl.days() + "d.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(new ByteArrayResource(bytes));
    }

    /** Quote a CSV field if it contains a comma, quote or newline. */
    private static String csv(String s) {
        if (s == null) return "";
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            return '"' + s.replace("\"", "\"\"") + '"';
        }
        return s;
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
