package com.example.backend.service;

import com.example.backend.entity.CartItem;
import com.example.backend.entity.CartItemDTO;
import com.example.backend.entity.MenuItem;
import com.example.backend.repository.CartItemRepository;
import com.example.backend.repository.MenuItemRepository;
import com.example.backend.repository.UserRepository;
import com.example.backend.tenant.TenantContext;
import com.example.backend.user.User;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RequiredArgsConstructor
@Service
public class CartService {
    private final CartItemRepository cartItemRepository;
    private final MenuItemRepository menuItemRepository;
    private final UserRepository userRepository;

    public CartItemDTO addItemToCart(UUID userId, UUID menuItemId, Integer quantity) {
        return addItemToCart(userId, menuItemId, quantity, null);
    }

    public CartItemDTO addItemToCart(UUID userId, UUID menuItemId, Integer quantity, String selectedChoicesJson) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        MenuItem menuItem = menuItemRepository.findById(menuItemId)
                .orElseThrow(() -> new RuntimeException("Menu item not found"));

        if (!Boolean.TRUE.equals(menuItem.getIsAvailable())) {
            throw new IllegalArgumentException("This item is currently unavailable");
        }

        CartItem cartItem = cartItemRepository.findByUserAndMenuItem(user, menuItem)
                .orElseGet(() -> {
                    CartItem newCartItem = new CartItem();
                    newCartItem.setUser(user);
                    newCartItem.setMenuItem(menuItem);
                    return newCartItem;
                });

        int existingQty = cartItem.getQuantity() == null ? 0 : cartItem.getQuantity();
        int newTotalQty = existingQty + quantity;

        // Only validate stock if the item has stock tracking enabled (stock > 0)
        if (menuItem.getStock() > 0 && newTotalQty > menuItem.getStock()) {
            int remaining = menuItem.getStock() - existingQty;
            if (remaining <= 0) {
                throw new IllegalArgumentException("No more stock available for this item");
            }
            throw new IllegalArgumentException("Only " + remaining + " left in stock");
        }

        cartItem.setQuantity(newTotalQty);
        if (selectedChoicesJson != null) {
            cartItem.setSelectedChoicesJson(selectedChoicesJson);
        }
        double unitPrice = menuItem.getPrice() + sumModifiers(cartItem.getSelectedChoicesJson());
        cartItem.setTotalPrice(unitPrice * cartItem.getQuantity());

        cartItem = cartItemRepository.save(cartItem);

        return convertToDTO(cartItem);
    }

    public List<CartItemDTO> getUserCartItems(UUID userId) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<CartItem> cartItems = (tenantId != null)
                ? cartItemRepository.findByUserIdAndTenantId(userId, tenantId)
                : cartItemRepository.findByUserId(userId);
        return cartItems.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    public CartItemDTO updateCartItem(UUID cartItemId, Integer quantity) {
        CartItem cartItem = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new RuntimeException("Cart item not found"));

        MenuItem menuItem = cartItem.getMenuItem();
        if (menuItem.getStock() > 0 && quantity > menuItem.getStock()) {
            throw new IllegalArgumentException("Only " + menuItem.getStock() + " left in stock");
        }

        cartItem.setQuantity(quantity);
        double unitPrice = cartItem.getMenuItem().getPrice() + sumModifiers(cartItem.getSelectedChoicesJson());
        cartItem.setTotalPrice(unitPrice * quantity);

        cartItem = cartItemRepository.save(cartItem);

        return convertToDTO(cartItem);
    }

    public void deleteCartItem(UUID cartItemId) {
        if (!cartItemRepository.existsById(cartItemId)) {
            throw new RuntimeException("Cart item not found");
        }
        cartItemRepository.deleteById(cartItemId);
    }

    @Transactional
    public void clearCartByUserId(UUID userId) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        List<CartItem> userCart = (tenantId != null)
                ? cartItemRepository.findByUserIdAndTenantId(userId, tenantId)
                : cartItemRepository.findByUserId(userId);
        cartItemRepository.deleteAll(userCart);
    }

    /** Sums the priceModifier values from a selectedChoicesJson string. */
    private double sumModifiers(String selectedChoicesJson) {
        if (selectedChoicesJson == null || selectedChoicesJson.isBlank()) return 0.0;
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode arr = mapper.readTree(selectedChoicesJson);
            double total = 0.0;
            if (arr.isArray()) {
                for (JsonNode node : arr) {
                    total += node.path("priceModifier").asDouble(0.0);
                }
            }
            return total;
        } catch (Exception e) {
            return 0.0;
        }
    }

    private CartItemDTO convertToDTO(CartItem cartItem) {
        CartItemDTO dto = new CartItemDTO();
        dto.setId(cartItem.getId());
        dto.setMenuItemId(cartItem.getMenuItem().getId());
        dto.setMenuItemName(cartItem.getMenuItem().getName());
        double effectiveUnitPrice = cartItem.getMenuItem().getPrice() + sumModifiers(cartItem.getSelectedChoicesJson());
        dto.setMenuItemPrice(effectiveUnitPrice);
        dto.setQuantity(cartItem.getQuantity());
        dto.setTotalPrice(cartItem.getTotalPrice());
        dto.setImage(cartItem.getMenuItem().getImage());
        dto.setMenuItemCategory(cartItem.getMenuItem().getCategory());
        dto.setSelectedChoicesJson(cartItem.getSelectedChoicesJson());
        dto.setOptionGroups(cartItem.getMenuItem().getOptionGroups());
        return dto;
    }
}
