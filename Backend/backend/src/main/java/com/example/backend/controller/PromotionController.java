package com.example.backend.controller;

import com.example.backend.dto.PromotionDTO;
import com.example.backend.service.PromotionService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/promotions")
@RequiredArgsConstructor
public class PromotionController {

    private final PromotionService promotionService;

    @GetMapping("/active")
    @Transactional
    public ResponseEntity<List<PromotionDTO>> getActive() {
        List<PromotionDTO> dtos = promotionService.getActivePromotions()
                .stream().map(PromotionDTO::from).toList();
        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/featured")
    @Transactional
    public ResponseEntity<PromotionDTO> getFeatured() {
        return promotionService.getFeaturedPromotion()
                .map(p -> ResponseEntity.ok(PromotionDTO.from(p)))
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/validate-code")
    @Transactional
    public ResponseEntity<?> validateCode(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        return promotionService.validateCode(code)
                .<ResponseEntity<?>>map(p -> ResponseEntity.ok(PromotionDTO.from(p)))
                .orElse(ResponseEntity.badRequest().body(Map.of(
                        "valid", false,
                        "message", "Invalid or expired promo code"
                )));
    }
}
