package com.example.backend.service;

import com.example.backend.entity.Tenant;
import com.example.backend.util.GeoUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Single source of truth for the delivery fee. Used by BOTH the quote endpoint
 * ({@code GET /api/tenants/{slug}/delivery-fee}) and order placement, so the fee a customer is SHOWN
 * is exactly the fee they are CHARGED — and the charged fee is computed server-side, never trusted from
 * the client (a distant customer could otherwise submit baseFee and skip the distance premium).
 *
 * fee = baseFee (per-store) + max(0, distanceKm − includedKm) × perKmRate, capped at maxFeeCap.
 * The delivery fee is platform revenue (see PayoutGenerationService) funding the platform's drivers, so
 * perKmRate / includedKm / cap are platform-wide config; only baseFee is per-store.
 */
@Service
public class DeliveryFeeService {

    @Value("${delivery.per-km-rate:2.50}")
    private double perKmRate;

    @Value("${delivery.included-km:0}")
    private double includedKm;

    @Value("${delivery.max-fee-cap:200}")
    private double maxFeeCap;

    /** Compute the authoritative fee + distance. No store coords (or no delivery point) → flat base fee. */
    public DeliveryFeeResult compute(Tenant tenant, Double lat, Double lon) {
        double baseFee = tenant.getDeliveryFeeBase() != null ? tenant.getDeliveryFeeBase().doubleValue() : 0.0;
        if (tenant.getLatitude() == null || tenant.getLongitude() == null || lat == null || lon == null) {
            return new DeliveryFeeResult(round2(baseFee), 0.0);
        }
        double distanceKm = GeoUtils.haversineKm(tenant.getLatitude(), tenant.getLongitude(), lat, lon);
        double fee = baseFee + Math.max(0, distanceKm - includedKm) * perKmRate;
        fee = Math.min(fee, maxFeeCap);
        return new DeliveryFeeResult(round2(fee), Math.round(distanceKm * 10.0) / 10.0);
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    public record DeliveryFeeResult(double fee, double distanceKm) {}
}
