package com.example.backend.controller;


import com.example.backend.entity.CartItemDTO;
import com.example.backend.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    // Add item to cart
    @PostMapping("/add")
    public ResponseEntity<?> addToCart(@RequestBody Map<String, Object> payload) {
        UUID userId = UUID.fromString(payload.get("userId").toString());
        UUID menuItemId = UUID.fromString(payload.get("menuItemId").toString());
        Integer quantity = Integer.valueOf(payload.get("quantity").toString());
        try {
            return ResponseEntity.ok(cartService.addItemToCart(userId, menuItemId, quantity));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Get user's cart by user ID
    @GetMapping("/{userId}")
    public ResponseEntity<List<CartItemDTO>> getUserCart(@PathVariable UUID userId) {
        List<CartItemDTO> cartItems = cartService.getUserCartItems(userId);
        return ResponseEntity.ok(cartItems);
    }


    // Update cart item quantity
    @PutMapping("/update/{cartItemId}")
    public ResponseEntity<?> updateCartItem(@PathVariable UUID cartItemId,
                                            @RequestBody Map<String, Object> payload) {
        Integer quantity = Integer.valueOf(payload.get("quantity").toString());
        try {
            return ResponseEntity.ok(cartService.updateCartItem(cartItemId, quantity));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Delete cart item
    @DeleteMapping("/delete/{cartItemId}")
    public ResponseEntity<Void> deleteCartItem(@PathVariable UUID cartItemId) {
        cartService.deleteCartItem(cartItemId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/clear/{userId}")
    public ResponseEntity<Void> clearCart(@PathVariable UUID userId) {
        cartService.clearCartByUserId(userId);
        return ResponseEntity.noContent().build();
    }

}
