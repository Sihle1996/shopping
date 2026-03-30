package com.example.backend.controller;


import com.example.backend.entity.CartItemDTO;
import com.example.backend.service.CartService;
import com.example.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @PostMapping("/add")
    public ResponseEntity<?> addToCart(@RequestBody Map<String, Object> payload,
                                       @AuthenticationPrincipal User principal) {
        UUID userId = principal.getId(); // always use authenticated user's ID
        UUID menuItemId = UUID.fromString(payload.get("menuItemId").toString());
        Integer quantity = Integer.valueOf(payload.get("quantity").toString());
        try {
            return ResponseEntity.ok(cartService.addItemToCart(userId, menuItemId, quantity));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<List<CartItemDTO>> getUserCart(@AuthenticationPrincipal User principal) {
        return ResponseEntity.ok(cartService.getUserCartItems(principal.getId()));
    }

    @PutMapping("/update/{cartItemId}")
    public ResponseEntity<?> updateCartItem(@PathVariable UUID cartItemId,
                                            @RequestBody Map<String, Object> payload,
                                            @AuthenticationPrincipal User principal) {
        Integer quantity = Integer.valueOf(payload.get("quantity").toString());
        try {
            return ResponseEntity.ok(cartService.updateCartItem(cartItemId, quantity));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/delete/{cartItemId}")
    public ResponseEntity<Void> deleteCartItem(@PathVariable UUID cartItemId,
                                               @AuthenticationPrincipal User principal) {
        cartService.deleteCartItem(cartItemId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/clear")
    public ResponseEntity<Void> clearCart(@AuthenticationPrincipal User principal) {
        cartService.clearCartByUserId(principal.getId());
        return ResponseEntity.noContent().build();
    }
}
