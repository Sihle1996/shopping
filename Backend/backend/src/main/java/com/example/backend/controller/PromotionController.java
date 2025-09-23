package com.example.backend.controller;

import com.example.backend.model.Promotion;
import com.example.backend.service.PromotionService;
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
    public ResponseEntity<List<Promotion>> getActive() {
        return ResponseEntity.ok(promotionService.getActivePromotions());
    }

    @GetMapping("/featured")
    public ResponseEntity<Promotion> getFeatured() {
        return promotionService.getFeaturedPromotion()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/validate-code")
    public ResponseEntity<?> validateCode(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        return promotionService.validateCode(code)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.badRequest().body(Map.of(
                        "valid", false,
                        "message", "Invalid or inactive code"
                )));
    }
}
