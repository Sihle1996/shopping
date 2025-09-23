package com.example.backend.controller;

import com.example.backend.dto.PromotionRequest;
import com.example.backend.model.Promotion;
import com.example.backend.repository.PromotionRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/admin/promotions")
@RequiredArgsConstructor
public class AdminPromotionController {

    private final PromotionRepository promotionRepository;

    @GetMapping
    public List<Promotion> list() {
        return promotionRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<Promotion> create(@Valid @RequestBody PromotionRequest req) {
        Promotion p = toEntity(new Promotion(), req);
        Promotion saved = promotionRepository.save(p);
        return ResponseEntity.created(URI.create("/api/admin/promotions/" + saved.getId())).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Promotion> update(@PathVariable Long id, @Valid @RequestBody PromotionRequest req) {
        return promotionRepository.findById(id)
                .map(existing -> ResponseEntity.ok(promotionRepository.save(toEntity(existing, req))))
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/activate")
    public ResponseEntity<Promotion> activate(@PathVariable Long id, @RequestParam boolean value) {
        return promotionRepository.findById(id)
                .map(p -> { p.setActive(value); return ResponseEntity.ok(promotionRepository.save(p)); })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/featured")
    public ResponseEntity<Promotion> featured(@PathVariable Long id, @RequestParam boolean value) {
        return promotionRepository.findById(id)
                .map(p -> { p.setFeatured(value); return ResponseEntity.ok(promotionRepository.save(p)); })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!promotionRepository.existsById(id)) return ResponseEntity.notFound().build();
        promotionRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private Promotion toEntity(Promotion target, PromotionRequest req) {
        target.setTitle(req.getTitle());
        target.setDescription(req.getDescription());
        target.setImageUrl(req.getImageUrl());
        target.setBadgeText(req.getBadgeText());
        target.setDiscountPercent(req.getDiscountPercent());
        target.setStartAt(req.getStartAt());
        target.setEndAt(req.getEndAt());
        target.setAppliesTo(req.getAppliesTo());
        target.setTargetCategoryId(req.getTargetCategoryId());
        target.setTargetProductId(req.getTargetProductId());
        target.setCode(req.getCode());
        target.setActive(req.isActive());
        target.setFeatured(req.isFeatured());
        return target;
    }
}
