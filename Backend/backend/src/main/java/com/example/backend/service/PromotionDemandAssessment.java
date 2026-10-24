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
}
