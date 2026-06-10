package com.example.backend.service;

import com.example.backend.entity.Payout;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.PayoutLedgerRepository;
import com.example.backend.repository.PayoutRepository;
import com.example.backend.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

/**
 * Turns the per-order payout LEDGER into periodic PENDING Payout records — the thing that
 * makes the store's "what am I owed?" Payouts page populate. The Partner Agreement promises
 * WEEKLY payouts, so this runs weekly; settlement (marking PAID) stays a super-admin action.
 *
 * Money identity (reconciles per order): customer paid = totalAmount + deliveryFee;
 * store credit (CREDIT) = totalAmount − platformFee; platform revenue = platformFee + deliveryFee.
 * The ledger holds CREDIT + FEE (on totalAmount); deliveryFee is platform revenue and never enters it.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PayoutGenerationService {

    private final PayoutRepository payoutRepository;
    private final PayoutLedgerRepository ledgerRepository;
    private final TenantRepository tenantRepository;
    private final EmailService emailService;

    /** Weekly settlement run — Monday 03:00 SAST. */
    @Scheduled(cron = "0 0 3 * * MON", zone = "Africa/Johannesburg")
    public void runWeekly() {
        int created = generateAll(Instant.now());
        log.info("Weekly payout run created {} payout(s).", created);
    }

    /** Generate a PENDING payout for every tenant with un-settled ledger activity. Returns the count. */
    public int generateAll(Instant periodEnd) {
        int created = 0;
        for (UUID tenantId : ledgerRepository.findTenantIdsWithLedger()) {
            try {
                if (generateForTenant(tenantId, periodEnd) != null) created++;
            } catch (Exception e) {
                log.error("Payout generation failed for tenant {}: {}", tenantId, e.getMessage());
            }
        }
        return created;
    }

    /**
     * Aggregate one tenant's ledger over [lastPeriodEnd, periodEnd) into a single PENDING payout.
     * grossRevenue = CREDIT + FEE; platformFee = FEE; netAmount = CREDIT − DEBIT (refunds reduce it).
     * Periods are contiguous + non-overlapping (start = the previous payout's end), so nothing is
     * double-paid or missed.
     */
    @Transactional
    public Payout generateForTenant(UUID tenantId, Instant periodEnd) {
        Instant lastEnd = payoutRepository.lastPeriodEnd(tenantId);
        Instant periodStart = lastEnd != null ? lastEnd : ledgerRepository.earliestEntry(tenantId);
        if (periodStart == null || !periodStart.isBefore(periodEnd)) return null;

        BigDecimal credit = ledgerRepository.sumByTypeInPeriod(tenantId, "CREDIT", periodStart, periodEnd);
        BigDecimal fee    = ledgerRepository.sumByTypeInPeriod(tenantId, "FEE",    periodStart, periodEnd);
        BigDecimal debit  = ledgerRepository.sumByTypeInPeriod(tenantId, "DEBIT",  periodStart, periodEnd);
        BigDecimal gross  = credit.add(fee).setScale(2, RoundingMode.HALF_UP);
        BigDecimal net    = credit.subtract(debit).setScale(2, RoundingMode.HALF_UP);
        if (gross.signum() <= 0 && net.signum() == 0) return null; // no activity this period

        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return null;

        Payout payout = new Payout();
        payout.setTenant(tenant);
        payout.setPeriodStart(periodStart);
        payout.setPeriodEnd(periodEnd);
        payout.setGrossRevenue(gross.doubleValue());
        payout.setPlatformFee(fee.doubleValue());
        payout.setPlatformFeePercent(gross.signum() > 0
                ? fee.divide(gross, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue() : 0);
        payout.setNetAmount(net.doubleValue());
        payoutRepository.save(payout); // status defaults to PENDING

        notify(tenant, net);
        return payout;
    }

    private void notify(Tenant tenant, BigDecimal net) {
        try {
            if (tenant.getEmail() != null && !tenant.getEmail().isBlank()) {
                emailService.sendRaw(tenant.getEmail(), "Your CraveIt payout is ready",
                        "<p>A new payout of <strong>R" + net.setScale(2, RoundingMode.HALF_UP)
                        + "</strong> has been calculated and is pending settlement. See your Payouts page for the breakdown.</p>");
            }
        } catch (Exception e) {
            log.warn("Payout notification failed for tenant {}: {}", tenant.getId(), e.getMessage());
        }
    }
}
