package com.example.backend.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PromotionDemandAssessmentTest {

    @Test
    void oneOrderCannotProduceStrongInsightEvenWithHighestRelativeScore() {
        assertEquals("WEAK", PromotionDemandAssessment.insightStrength(1, 1.0));
        assertEquals("LOW", PromotionDemandAssessment.dataSufficiency(1));
    }

    @Test
    void fiveToFourteenOrdersAreCappedAtModerateStrength() {
        assertEquals("MODERATE", PromotionDemandAssessment.insightStrength(5, 1.0));
        assertEquals("LIMITED", PromotionDemandAssessment.dataSufficiency(5));
        assertEquals("STRONG", PromotionDemandAssessment.insightStrength(15, 1.0));
        assertEquals("ADEQUATE", PromotionDemandAssessment.dataSufficiency(15));
    }

    @Test
    void promotionDiscountPreservesConservativeGrossMarginBuffer() {
        assertEquals(0.0, PromotionDemandAssessment.maxSafeDiscountPercent(8.0));
        assertEquals(5.0, PromotionDemandAssessment.maxSafeDiscountPercent(15.0));
        assertEquals(18.0, PromotionDemandAssessment.maxSafeDiscountPercent(30.0));
        assertEquals(18.0, PromotionDemandAssessment.maxSafeDiscountPercent(60.0));
        assertEquals(0.0, PromotionDemandAssessment.maxSafeDiscountPercent(Double.NaN));
    }

    @Test
    void sufficientOrderHistoryAllowsRelativeRankingToSetStrength() {
        assertEquals("STRONG", PromotionDemandAssessment.insightStrength(20, 0.8));
        assertEquals("MODERATE", PromotionDemandAssessment.insightStrength(20, 0.5));
        assertEquals("WEAK", PromotionDemandAssessment.insightStrength(20, 0.2));
        assertEquals("ADEQUATE", PromotionDemandAssessment.dataSufficiency(20));
    }
}
