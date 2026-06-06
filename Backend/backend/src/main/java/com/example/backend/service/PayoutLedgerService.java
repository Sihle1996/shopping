package com.example.backend.service;

import com.example.backend.entity.Order;
import com.example.backend.entity.PayoutLedgerEntry;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.PayoutLedgerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PayoutLedgerService {

    private final PayoutLedgerRepository ledgerRepository;

    public void recordOrderCredit(Order order) {
        Tenant tenant = order.getTenant();
        if (tenant == null) return;

        BigDecimal orderTotal = BigDecimal.valueOf(order.getTotalAmount());
        BigDecimal platformFee = order.getPlatformFee() != null
                ? BigDecimal.valueOf(order.getPlatformFee())
                : BigDecimal.ZERO;
        BigDecimal credit = orderTotal.subtract(platformFee).setScale(2, RoundingMode.HALF_UP);

        BigDecimal currentBalance = ledgerRepository.computeBalance(tenant.getId());

        // Credit entry (order revenue minus platform fee)
        ledgerRepository.save(PayoutLedgerEntry.builder()
                .tenant(tenant)
                .order(order)
                .entryType("CREDIT")
                .amountRand(credit)
                .balanceAfter(currentBalance.add(credit))
                .description("Order #" + order.getId().toString().substring(0, 8) + " delivered")
                .build());

        // Fee entry
        if (platformFee.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal balanceAfterFee = currentBalance.add(credit);
            ledgerRepository.save(PayoutLedgerEntry.builder()
                    .tenant(tenant)
                    .order(order)
                    .entryType("FEE")
                    .amountRand(platformFee)
                    .balanceAfter(balanceAfterFee)
                    .description("Platform fee on order #" + order.getId().toString().substring(0, 8))
                    .build());
        }
    }

    public void recordRefundDebit(Order order) {
        Tenant tenant = order.getTenant();
        if (tenant == null) return;

        BigDecimal orderTotal = BigDecimal.valueOf(order.getTotalAmount());
        BigDecimal currentBalance = ledgerRepository.computeBalance(tenant.getId());

        ledgerRepository.save(PayoutLedgerEntry.builder()
                .tenant(tenant)
                .order(order)
                .entryType("DEBIT")
                .amountRand(orderTotal)
                .balanceAfter(currentBalance.subtract(orderTotal))
                .description("Refund — order #" + order.getId().toString().substring(0, 8) + " cancelled")
                .build());
    }

    public Page<PayoutLedgerEntry> getLedger(UUID tenantId, Pageable pageable) {
        return ledgerRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId, pageable);
    }

    public BigDecimal getBalance(UUID tenantId) {
        return ledgerRepository.computeBalance(tenantId);
    }
}
