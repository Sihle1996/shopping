package com.example.backend.controller;

import com.example.backend.config.AuthUtil;
import com.example.backend.entity.Favourite;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.FavouriteRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.TenantRepository;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.User;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/favourites")
@RequiredArgsConstructor
public class FavouriteController {

    private final FavouriteRepository favouriteRepository;
    private final MenuItemRepository menuItemRepository;
    private final TenantRepository tenantRepository;
    private final AuthUtil authUtil;

    @GetMapping
    @Transactional
    public List<FavouriteItem> getFavourites(Authentication authentication) {
        User user = authUtil.getCurrentUser(authentication);
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return List.of();
        return favouriteRepository.findByUser_IdAndTenant_IdOrderByCreatedAtDesc(user.getId(), tenantId)
                .stream()
                .map(f -> FavouriteItem.from(f.getMenuItem()))
                .toList();
    }

    @PostMapping("/{menuItemId}")
    @Transactional
    public ResponseEntity<Map<String, Boolean>> toggle(@PathVariable UUID menuItemId, Authentication authentication) {
        User user = authUtil.getCurrentUser(authentication);
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) return ResponseEntity.badRequest().build();

        boolean alreadyFavourited = favouriteRepository.existsByUser_IdAndMenuItem_Id(user.getId(), menuItemId);
        if (alreadyFavourited) {
            favouriteRepository.deleteByUser_IdAndMenuItem_Id(user.getId(), menuItemId);
            return ResponseEntity.ok(Map.of("favourited", false));
        }

        MenuItem menuItem = menuItemRepository.findById(menuItemId).orElse(null);
        if (menuItem == null) return ResponseEntity.notFound().build();
        Tenant tenant = tenantRepository.findById(tenantId).orElse(null);
        if (tenant == null) return ResponseEntity.notFound().build();

        favouriteRepository.save(Favourite.builder()
                .user(user)
                .menuItem(menuItem)
                .tenant(tenant)
                .build());
        return ResponseEntity.ok(Map.of("favourited", true));
    }

    record FavouriteItem(UUID id, String name, String description, Double price, String image, String category, boolean available) {
        static FavouriteItem from(MenuItem m) {
            return new FavouriteItem(m.getId(), m.getName(), m.getDescription(), m.getPrice(),
                    m.getImage(), m.getCategory(), Boolean.TRUE.equals(m.getIsAvailable()));
        }
    }
}
