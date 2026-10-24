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
    void fiveToFifteenOrdersAreCappedAtModerateStrength() {
        assertEquals("MODERATE", PromotionDemandAssessment.insightStrength(5, 1.0));
        assertEquals("LIMITED", PromotionDemandAssessment.dataSufficiency(5));
        assertEquals("MODERATE", PromotionDemandAssessment.insightStrength(15, 1.0));
    }

    @Test
    void sufficientOrderHistoryAllowsRelativeRankingToSetStrength() {
        assertEquals("STRONG", PromotionDemandAssessment.insightStrength(20, 0.8));
        assertEquals("MODERATE", PromotionDemandAssessment.insightStrength(20, 0.5));
        assertEquals("WEAK", PromotionDemandAssessment.insightStrength(20, 0.2));
        assertEquals("ADEQUATE", PromotionDemandAssessment.dataSufficiency(20));
    }
}
