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
    void basketThresholdStrengthRequiresAdequateSampleForStrongLabel() {
        assertEquals("MODERATE", PromotionDemandAssessment.basketThresholdStrength(12, 0.35));
        assertEquals("MODERATE", PromotionDemandAssessment.basketThresholdStrength(14, 0.30));
        assertEquals("STRONG", PromotionDemandAssessment.basketThresholdStrength(15, 0.30));
        assertEquals("WEAK", PromotionDemandAssessment.basketThresholdStrength(15, 0.15));
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
    void calculatesGrossMarginOnDiscountedSellingPrice() {
        assertEquals(56.043956, PromotionDemandAssessment.estimatedGrossMarginAfterDiscountPercent(60.0, 9.0), 0.001);
        assertEquals(51.764706, PromotionDemandAssessment.estimatedGrossMarginAfterDiscountPercent(59.0, 15.0), 0.001);
        assertEquals(43.529412, PromotionDemandAssessment.estimatedGrossMarginAfterDiscountPercent(52.0, 15.0), 0.001);
    }

    @Test
    void postDiscountGrossMarginIsUnavailableForUnsafeOrInvalidInputs() {
        org.junit.jupiter.api.Assertions.assertNull(
                PromotionDemandAssessment.estimatedGrossMarginAfterDiscountPercent(10.0, 10.0));
        org.junit.jupiter.api.Assertions.assertNull(
                PromotionDemandAssessment.estimatedGrossMarginAfterDiscountPercent(Double.NaN, 5.0));
    }

    @Test
    void calculatesExtraUnitVolumeNeededToOffsetDiscountAtGrossMarginLevel() {
        assertEquals(50.0, PromotionDemandAssessment.requiredVolumeIncreasePercent(30.0, 10.0), 0.001);
        assertEquals(100.0, PromotionDemandAssessment.requiredVolumeIncreasePercent(30.0, 15.0), 0.001);
        assertEquals(0.0, PromotionDemandAssessment.requiredVolumeIncreasePercent(30.0, 0.0), 0.001);
    }

    @Test
    void breakEvenVolumeIsUnavailableWhenDiscountConsumesAllGrossMargin() {
        org.junit.jupiter.api.Assertions.assertNull(
                PromotionDemandAssessment.requiredVolumeIncreasePercent(10.0, 10.0));
        org.junit.jupiter.api.Assertions.assertNull(
                PromotionDemandAssessment.requiredVolumeIncreasePercent(Double.NaN, 5.0));
    }

    @Test
    void sufficientOrderHistoryAllowsRelativeRankingToSetStrength() {
        assertEquals("STRONG", PromotionDemandAssessment.insightStrength(20, 0.8));
        assertEquals("MODERATE", PromotionDemandAssessment.insightStrength(20, 0.5));
        assertEquals("WEAK", PromotionDemandAssessment.insightStrength(20, 0.2));
        assertEquals("ADEQUATE", PromotionDemandAssessment.dataSufficiency(20));
    }
}
