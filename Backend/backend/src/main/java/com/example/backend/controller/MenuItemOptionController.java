package com.example.backend.controller;

import com.example.backend.entity.MenuItem;
import com.example.backend.entity.MenuItemOptionChoice;
import com.example.backend.entity.MenuItemOptionGroup;
import com.example.backend.repository.MenuItemOptionChoiceRepository;
import com.example.backend.repository.MenuItemOptionGroupRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.tenant.TenantContext;
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

    /** The menu item only if it belongs to the caller's tenant — otherwise null.
     *  Without this, an admin could read/mutate another tenant's option groups by guessing ids. */
    private MenuItem ownedItem(UUID menuItemId) {
        UUID tid = TenantContext.getCurrentTenantId();
        return menuItemRepository.findById(menuItemId)
                .filter(mi -> tid == null || (mi.getTenant() != null && tid.equals(mi.getTenant().getId())))
                .orElse(null);
    }

    private static boolean groupUnder(MenuItemOptionGroup g, UUID menuItemId) {
        return g.getMenuItem() != null && menuItemId.equals(g.getMenuItem().getId());
    }

    private static boolean choiceUnder(MenuItemOptionChoice c, UUID groupId, UUID menuItemId) {
        return c.getOptionGroup() != null && groupId.equals(c.getOptionGroup().getId())
                && groupUnder(c.getOptionGroup(), menuItemId);
    }

    // ── Groups ────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<List<MenuItemOptionGroup>> getGroups(@PathVariable UUID menuItemId) {
        if (ownedItem(menuItemId) == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(groupRepository.findByMenuItem_IdOrderBySortOrderAsc(menuItemId));
    }

    @PostMapping
    public ResponseEntity<MenuItemOptionGroup> createGroup(
            @PathVariable UUID menuItemId,
            @RequestBody MenuItemOptionGroup body) {
        MenuItem item = ownedItem(menuItemId);
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
        if (ownedItem(menuItemId) == null) return ResponseEntity.notFound().build();
        return groupRepository.findById(groupId)
                .filter(g -> groupUnder(g, menuItemId))
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
        if (ownedItem(menuItemId) == null) return ResponseEntity.notFound().build();
        return groupRepository.findById(groupId)
                .filter(g -> groupUnder(g, menuItemId))
                .map(g -> { groupRepository.delete(g); return ResponseEntity.noContent().<Void>build(); })
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Choices ───────────────────────────────────────────────────────────────

    @PostMapping("/{groupId}/choices")
    public ResponseEntity<MenuItemOptionChoice> addChoice(
            @PathVariable UUID menuItemId,
            @PathVariable UUID groupId,
            @RequestBody MenuItemOptionChoice body) {
        if (ownedItem(menuItemId) == null) return ResponseEntity.notFound().build();
        return groupRepository.findById(groupId)
                .filter(g -> groupUnder(g, menuItemId))
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
        if (ownedItem(menuItemId) == null) return ResponseEntity.notFound().build();
        return choiceRepository.findById(choiceId)
                .filter(c -> choiceUnder(c, groupId, menuItemId))
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
        if (ownedItem(menuItemId) == null) return ResponseEntity.notFound().build();
        return choiceRepository.findById(choiceId)
                .filter(c -> choiceUnder(c, groupId, menuItemId))
                .map(c -> { choiceRepository.delete(c); return ResponseEntity.noContent().<Void>build(); })
                .orElse(ResponseEntity.notFound().build());
    }
}
