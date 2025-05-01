package com.example.backend.controller;


import com.example.backend.entity.CartItemDTO;
import com.example.backend.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    // Add item to cart
    @PostMapping("/add")
    public ResponseEntity<CartItemDTO> addToCart(@RequestBody Map<String, Object> payload) {
        Long userId = Long.valueOf(payload.get("userId").toString());
        Long menuItemId = Long.valueOf(payload.get("menuItemId").toString());
        Integer quantity = Integer.valueOf(payload.get("quantity").toString());

        CartItemDTO cartItemDTO = cartService.addItemToCart(userId, menuItemId, quantity);
        return ResponseEntity.ok(cartItemDTO);
    }

    // Get user's cart by user ID
    @GetMapping("/{userId}")
    public ResponseEntity<List<CartItemDTO>> getUserCart(@PathVariable Long userId) {
        List<CartItemDTO> cartItems = cartService.getUserCartItems(userId);
        return ResponseEntity.ok(cartItems);
    }


    // Update cart item quantity
    @PutMapping("/update/{cartItemId}")
    public ResponseEntity<CartItemDTO> updateCartItem(@PathVariable Long cartItemId,
                                                      @RequestParam Integer quantity) {
        CartItemDTO updatedCartItemDTO = cartService.updateCartItem(cartItemId, quantity);
        return ResponseEntity.ok(updatedCartItemDTO);
    }

    // Delete cart item
    @DeleteMapping("/delete/{cartItemId}")
    public ResponseEntity<Void> deleteCartItem(@PathVariable Long cartItemId) {
        cartService.deleteCartItem(cartItemId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/clear/{userId}")
    public ResponseEntity<Void> clearCart(@PathVariable Long userId) {
        cartService.clearCartByUserId(userId);
        return ResponseEntity.noContent().build();
    }

}
