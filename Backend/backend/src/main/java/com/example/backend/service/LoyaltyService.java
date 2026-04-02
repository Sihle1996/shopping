package com.example.backend.service;

import com.example.backend.entity.LoyaltyAccount;
import com.example.backend.entity.LoyaltyTransaction;
import com.example.backend.entity.Order;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.LoyaltyAccountRepository;
import com.example.backend.repository.LoyaltyTransactionRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import jakarta.transaction.Transactional;

import java.util.UUID;

/**
 * Loyalty points rules:
 *   Earn:   1 point per R10 spent (rounded down)
 *   Redeem: 100 points = R10 discount (min 100 points)
 */
@Service
@RequiredArgsConstructor
public class LoyaltyService {

    private static final int POINTS_PER_RAND = 1;       // 1 point per R10
    private static final int RANDS_DIVISOR   = 10;
    public  static final int POINTS_PER_REDEMPTION = 100; // 100 pts = R10
    public  static final double RAND_VALUE_PER_100  = 10.0;

    private final LoyaltyAccountRepository accountRepo;
    private final LoyaltyTransactionRepository txRepo;
    private final TenantRepository tenantRepository;

    /** Get or create the loyalty account for this user + tenant */
    public LoyaltyAccount getOrCreate(User user, Tenant tenant) {
        return accountRepo.findByUser_IdAndTenant_Id(user.getId(), tenant.getId())
                .orElseGet(() -> {
                    LoyaltyAccount acc = new LoyaltyAccount();
                    acc.setUser(user);
                    acc.setTenant(tenant);
                    return accountRepo.save(acc);
                });
    }

    /** Called after order is placed — awards points */
    @Transactional
    public void awardPoints(User user, Order order) {
        if (user == null || order.getTenant() == null) return;
        int points = (int) (order.getTotalAmount() / RANDS_DIVISOR) * POINTS_PER_RAND;
        if (points <= 0) return;

        LoyaltyAccount acc = getOrCreate(user, order.getTenant());
        acc.setBalance(acc.getBalance() + points);
        acc.setTotalEarned(acc.getTotalEarned() + points);
        accountRepo.save(acc);

        LoyaltyTransaction tx = new LoyaltyTransaction();
        tx.setAccount(acc);
        tx.setOrder(order);
        tx.setPoints(points);
        tx.setType("EARNED");
        tx.setDescription("Earned " + points + " pts on order R" + String.format("%.2f", order.getTotalAmount()));
        txRepo.save(tx);
    }

    /** Called at checkout — deducts points and returns rand discount */
    @Transactional
    public double redeemPoints(User user, UUID tenantId, int pointsToRedeem) {
        if (pointsToRedeem < POINTS_PER_REDEMPTION) {
            throw new IllegalArgumentException("Minimum redemption is " + POINTS_PER_REDEMPTION + " points.");
        }
        if (pointsToRedeem % POINTS_PER_REDEMPTION != 0) {
            throw new IllegalArgumentException("Points must be a multiple of " + POINTS_PER_REDEMPTION + ".");
        }

        LoyaltyAccount acc = accountRepo.findByUser_IdAndTenant_Id(user.getId(), tenantId)
                .orElseThrow(() -> new IllegalArgumentException("No loyalty account found."));
        if (acc.getBalance() < pointsToRedeem) {
            throw new IllegalArgumentException("Insufficient points. Balance: " + acc.getBalance());
        }

        acc.setBalance(acc.getBalance() - pointsToRedeem);
        accountRepo.save(acc);

        double discount = (pointsToRedeem / (double) POINTS_PER_REDEMPTION) * RAND_VALUE_PER_100;

        LoyaltyTransaction tx = new LoyaltyTransaction();
        tx.setAccount(acc);
        tx.setPoints(-pointsToRedeem);
        tx.setType("REDEEMED");
        tx.setDescription("Redeemed " + pointsToRedeem + " pts for R" + String.format("%.2f", discount) + " discount");
        txRepo.save(tx);

        return discount;
    }

    public int getBalance(User user, UUID tenantId) {
        return accountRepo.findByUser_IdAndTenant_Id(user.getId(), tenantId)
                .map(LoyaltyAccount::getBalance)
                .orElse(0);
    }
}
