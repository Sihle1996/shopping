package com.example.backend.service;

import com.example.backend.entity.DriverLedgerEntry;
import com.example.backend.entity.Order;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.DriverLedgerRepository;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

/**
 * Credits drivers their real, accruing pay — a flat base fee per completed delivery plus 100% of the
 * customer's tip — into the driver ledger. Mirrors {@link PayoutLedgerService} (the store ledger).
 */
@Service
@RequiredArgsConstructor
public class DriverLedgerService {

    private final DriverLedgerRepository ledgerRepository;

    /** Base pay + tip, on delivery. Idempotent (guards the admin + driver delivery paths). */
    public void recordDriverCredit(Order order) {
        User driver = order.getDriver();
        if (driver == null) return; // unassigned / self-delivery — nothing to credit
        if (Boolean.TRUE.equals(order.getDriverCredited())) return;
        order.setDriverCredited(true);

        Tenant tenant = order.getTenant();
        BigDecimal base = (tenant != null && tenant.getDriverBaseFee() != null)
                ? tenant.getDriverBaseFee()
                : new BigDecimal("25.00");
        base = base.setScale(2, RoundingMode.HALF_UP);

        BigDecimal tip = order.getTipAmount() != null
                ? BigDecimal.valueOf(order.getTipAmount()).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        String shortId = order.getId().toString().substring(0, 8);
        BigDecimal balance = ledgerRepository.computeBalance(driver.getId());

        if (base.compareTo(BigDecimal.ZERO) > 0) {
            balance = balance.add(base);
            ledgerRepository.save(DriverLedgerEntry.builder()
                    .driver(driver).order(order)
                    .entryType("EARNING").amountRand(base).balanceAfter(balance)
                    .description("Delivery #" + shortId)
                    .build());
        }
        if (tip.compareTo(BigDecimal.ZERO) > 0) {
            balance = balance.add(tip);
            ledgerRepository.save(DriverLedgerEntry.builder()
                    .driver(driver).order(order)
                    .entryType("TIP").amountRand(tip).balanceAfter(balance)
                    .description("Tip on #" + shortId)
                    .build());
        }
    }

    /** Records a settlement (the store paid the driver), debiting the owed balance. */
    public DriverLedgerEntry recordDriverPayout(User driver, BigDecimal amount, String note) {
        BigDecimal amt = amount.setScale(2, RoundingMode.HALF_UP);
        BigDecimal balance = ledgerRepository.computeBalance(driver.getId()).subtract(amt);
        return ledgerRepository.save(DriverLedgerEntry.builder()
                .driver(driver)
                .entryType("PAYOUT").amountRand(amt).balanceAfter(balance)
                .description(note != null && !note.isBlank() ? note : "Payout")
                .build());
    }

    public BigDecimal owedBalance(UUID driverId) {
        return ledgerRepository.computeBalance(driverId);
    }
}
