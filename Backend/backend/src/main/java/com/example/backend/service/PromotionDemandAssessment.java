package com.example.backend.service;

/**
 * Separates the strength of a relative recommendation from the amount of evidence behind it.
 * Order thresholds are deliberately conservative and can be tuned after observing real store data.
 */
final class PromotionDemandAssessment {

    private static final long LIMITED_EVIDENCE_MAX_ORDERS = 4;
    private static final long EARLY_SIGNAL_MAX_ORDERS = 14;

    private PromotionDemandAssessment() {
    }

    static String insightStrength(long distinctOrders, double relativeScore) {
        if (distinctOrders <= LIMITED_EVIDENCE_MAX_ORDERS) {
            return "WEAK";
        }
        if (distinctOrders <= EARLY_SIGNAL_MAX_ORDERS) {
            return relativeScore >= 0.66 ? "MODERATE" : "WEAK";
        }
        if (relativeScore >= 0.66) {
            return "STRONG";
        }
        return relativeScore >= 0.33 ? "MODERATE" : "WEAK";
    }

    static String dataSufficiency(long distinctOrders) {
        if (distinctOrders <= LIMITED_EVIDENCE_MAX_ORDERS) {
            return "LOW";
        }
        if (distinctOrders <= EARLY_SIGNAL_MAX_ORDERS) {
            return "LIMITED";
        }
        return "ADEQUATE";
    }

    /**
     * Basket-threshold evidence must account for sample size as well as the near-miss share.
     * A high percentage from 12–14 orders is not enough to label a recommendation STRONG.
     */
    static String basketThresholdStrength(long distinctOrders, double nearMissShare) {
        if (distinctOrders < 15) {
            return nearMissShare >= 0.22 ? "MODERATE" : "WEAK";
        }
        if (nearMissShare >= 0.30) return "STRONG";
        return nearMissShare >= 0.22 ? "MODERATE" : "WEAK";
    }

    /**
     * Conservative discount ceiling in percentage points of the selling price.
     * Keep at least 10 percentage points of price as gross margin, or 40% of the
     * item's original gross margin when that is larger. This is a gross-margin
     * guard only; payment, platform and other variable fees are not modeled here.
     */
    static double maxSafeDiscountPercent(double grossMarginPercent) {
        if (!Double.isFinite(grossMarginPercent) || grossMarginPercent <= 0) {
            return 0.0;
        }
        double retainedMargin = Math.max(10.0, grossMarginPercent * 0.40);
        return Math.max(0.0, Math.min(18.0, grossMarginPercent - retainedMargin));
    }
}
