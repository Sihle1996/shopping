package com.example.backend.service;

import com.example.backend.entity.GroupCart;
import com.example.backend.entity.GroupCartItem;
import com.example.backend.entity.MenuItem;
import com.example.backend.entity.Tenant;
import com.example.backend.repository.GroupCartItemRepository;
import com.example.backend.repository.GroupCartRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.user.User;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GroupCartService {

    private final GroupCartRepository groupCartRepo;
    private final GroupCartItemRepository groupCartItemRepo;
    private final MenuItemRepository menuItemRepo;
    private final ObjectMapper objectMapper;

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    private static final int TOKEN_LEN = 8;
    private static final SecureRandom RNG = new SecureRandom();

    @Transactional
    public GroupCart create(User owner, Tenant tenant) {
        GroupCart gc = new GroupCart();
        gc.setToken(uniqueToken());
        gc.setOwner(owner);
        gc.setTenant(tenant);
        return groupCartRepo.save(gc);
    }

    public GroupCart getByToken(String token) {
        return groupCartRepo.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Group cart not found"));
    }

    @Transactional
    public GroupCartItem addItem(String token, User user, UUID menuItemId, int quantity,
                                 String selectedChoicesJson, String itemNotes) {
        GroupCart gc = getByToken(token);
        if (!"OPEN".equals(gc.getStatus()))
            throw new IllegalStateException("This group cart is no longer active");

        MenuItem menuItem = menuItemRepo.findById(menuItemId)
                .orElseThrow(() -> new IllegalArgumentException("Menu item not found"));

        double modSum = 0;
        if (selectedChoicesJson != null && !selectedChoicesJson.isBlank()) {
            try {
                JsonNode arr = objectMapper.readTree(selectedChoicesJson);
                for (JsonNode n : arr) modSum += n.path("priceModifier").asDouble(0);
            } catch (Exception ignored) {}
        }

        GroupCartItem item = new GroupCartItem();
        item.setGroupCart(gc);
        item.setAddedBy(user);
        item.setMenuItem(menuItem);
        item.setQuantity(quantity);
        item.setUnitPrice(menuItem.getPrice() + modSum);
        item.setSelectedChoicesJson(selectedChoicesJson);
        item.setItemNotes(itemNotes);
        return groupCartItemRepo.save(item);
    }

    @Transactional
    public void removeItem(String token, UUID itemId, User user) {
        GroupCartItem item = groupCartItemRepo.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Item not found"));
        if (!item.getGroupCart().getToken().equals(token))
            throw new IllegalArgumentException("Item does not belong to this cart");
        boolean isOwner = item.getGroupCart().getOwner().getId().equals(user.getId());
        boolean isAdder = item.getAddedBy().getId().equals(user.getId());
        if (!isOwner && !isAdder)
            throw new IllegalStateException("Not authorised to remove this item");
        groupCartItemRepo.delete(item);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summarize(String token) {
        GroupCart gc = getByToken(token);
        double total = gc.getItems().stream()
                .mapToDouble(i -> i.getUnitPrice() * i.getQuantity())
                .sum();
        String ownerName = gc.getOwner().getFullName() != null && !gc.getOwner().getFullName().isBlank()
                ? gc.getOwner().getFullName() : gc.getOwner().getEmail();
        String logoUrl = gc.getTenant().getLogoUrl() != null ? gc.getTenant().getLogoUrl() : "";

        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("id",        gc.getId().toString());
        result.put("token",     gc.getToken());
        result.put("status",    gc.getStatus());
        result.put("ownerId",   gc.getOwner().getId().toString());
        result.put("ownerName", ownerName);
        result.put("storeName", gc.getTenant().getName());
        result.put("storeSlug", gc.getTenant().getSlug());
        result.put("logoUrl",   logoUrl);
        result.put("items",     gc.getItems());
        result.put("total",     Math.round(total * 100.0) / 100.0);
        return result;
    }

    @Transactional
    public void close(String token, User requestingUser) {
        GroupCart gc = getByToken(token);
        if (!gc.getOwner().getId().equals(requestingUser.getId()))
            throw new IllegalStateException("Only the owner can close the cart");
        gc.setStatus("CHECKED_OUT");
        groupCartRepo.save(gc);
    }

    private String uniqueToken() {
        String token;
        do {
            StringBuilder sb = new StringBuilder(TOKEN_LEN);
            for (int i = 0; i < TOKEN_LEN; i++) sb.append(CHARS.charAt(RNG.nextInt(CHARS.length())));
            token = sb.toString();
        } while (groupCartRepo.findByToken(token).isPresent());
        return token;
    }
}
