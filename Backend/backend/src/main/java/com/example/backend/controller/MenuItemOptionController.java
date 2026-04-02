package com.example.backend.controller;

import com.example.backend.entity.MenuItemOptionChoice;
import com.example.backend.entity.MenuItemOptionGroup;
import com.example.backend.repository.MenuItemOptionChoiceRepository;
import com.example.backend.repository.MenuItemOptionGroupRepository;
import com.example.backend.repository.MenuItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/menu-items/{menuItemId}/options")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class MenuItemOptionController {

    private final MenuItemRepository menuItemRepository;
    private final MenuItemOptionGroupRepository groupRepository;
    private final MenuItemOptionChoiceRepository choiceRepository;

    // ── Groups ────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<MenuItemOptionGroup>> getGroups(@PathVariable UUID menuItemId) {
        return ResponseEntity.ok(groupRepository.findByMenuItem_IdOrderBySortOrderAsc(menuItemId));
    }

    @PostMapping
    public ResponseEntity<MenuItemOptionGroup> createGroup(
            @PathVariable UUID menuItemId,
            @RequestBody MenuItemOptionGroup body) {
        var item = menuItemRepository.findById(menuItemId)
                .orElse(null);
        if (item == null) return ResponseEntity.notFound().build();
        body.setMenuItem(item);
        body.setId(null);
        return ResponseEntity.ok(groupRepository.save(body));
    }

    @PutMapping("/{groupId}")
    public ResponseEntity<MenuItemOptionGroup> updateGroup(
            @PathVariable UUID menuItemId,
            @PathVariable UUID groupId,
            @RequestBody MenuItemOptionGroup body) {
        return groupRepository.findById(groupId)
                .map(g -> {
                    if (body.getName() != null) g.setName(body.getName());
                    if (body.getType() != null) g.setType(body.getType());
                    if (body.getRequired() != null) g.setRequired(body.getRequired());
                    if (body.getSortOrder() != null) g.setSortOrder(body.getSortOrder());
                    return ResponseEntity.ok(groupRepository.save(g));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> deleteGroup(
            @PathVariable UUID menuItemId,
            @PathVariable UUID groupId) {
        if (!groupRepository.existsById(groupId)) return ResponseEntity.notFound().build();
        groupRepository.deleteById(groupId);
        return ResponseEntity.noContent().build();
    }

    // ── Choices ───────────────────────────────────────────────────────────────

    @PostMapping("/{groupId}/choices")
    public ResponseEntity<MenuItemOptionChoice> addChoice(
            @PathVariable UUID menuItemId,
            @PathVariable UUID groupId,
            @RequestBody MenuItemOptionChoice body) {
        return groupRepository.findById(groupId)
                .map(g -> {
                    body.setOptionGroup(g);
                    body.setId(null);
                    return ResponseEntity.ok(choiceRepository.save(body));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{groupId}/choices/{choiceId}")
    public ResponseEntity<MenuItemOptionChoice> updateChoice(
            @PathVariable UUID menuItemId,
            @PathVariable UUID groupId,
            @PathVariable UUID choiceId,
            @RequestBody MenuItemOptionChoice body) {
        return choiceRepository.findById(choiceId)
                .map(c -> {
                    if (body.getLabel() != null) c.setLabel(body.getLabel());
                    if (body.getPriceModifier() != null) c.setPriceModifier(body.getPriceModifier());
                    if (body.getSortOrder() != null) c.setSortOrder(body.getSortOrder());
                    return ResponseEntity.ok(choiceRepository.save(c));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{groupId}/choices/{choiceId}")
    public ResponseEntity<Void> deleteChoice(
            @PathVariable UUID menuItemId,
            @PathVariable UUID groupId,
            @PathVariable UUID choiceId) {
        if (!choiceRepository.existsById(choiceId)) return ResponseEntity.notFound().build();
        choiceRepository.deleteById(choiceId);
        return ResponseEntity.noContent().build();
    }
}
