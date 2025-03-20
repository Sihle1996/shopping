import { Component, OnInit } from '@angular/core';
import { CartService, CartItem } from 'src/app/services/cart.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit {
  cartItems: CartItem[] = [];
  totalPrice = 0;
  userId: number | null = null;

  constructor(private cartService: CartService, private router: Router) {}

  ngOnInit(): void {
    const userIdString = localStorage.getItem('userId');
    this.userId = userIdString ? Number(userIdString) : null;

    // ✅ Redirect to login if userId is missing or invalid
    if (!this.userId || isNaN(this.userId) || this.userId <= 0) {
      console.error("User not logged in. Redirecting to login...");
      this.router.navigate(['/login']);
      return;
    }

    // ✅ Fetch cart items
    this.cartService.getCartItems(this.userId).subscribe({
      next: (items) => {
        this.cartItems = items;
        this.updateTotalPrice();
      },
      error: (err) => {
        console.error("Error fetching cart items:", err);
      }
    });

    // ✅ Fetch total price
    this.cartService.getTotalPrice().subscribe({
      next: (price) => {
        this.totalPrice = price;
      },
      error: (err) => {
        console.error("Error fetching total price:", err);
      }
    });
  }

  // ✅ Increase quantity
  increaseQuantity(item: CartItem): void {
    this.cartService.updateCartItem(item.id, item.quantity + 1, this.userId!).subscribe({
      next: () => {
        item.quantity++;
        this.updateTotalPrice();
      },
      error: (err) => {
        console.error("Error updating quantity:", err);
      }
    });
  }

  // ✅ Decrease quantity
  decreaseQuantity(item: CartItem): void {
    if (item.quantity > 1) {
      this.cartService.updateCartItem(item.id, item.quantity - 1, this.userId!).subscribe({
        next: () => {
          item.quantity--;
          this.updateTotalPrice();
        },
        error: (err) => {
          console.error("Error updating quantity:", err);
        }
      });
    }
  }

  // ✅ Remove item from cart
  removeItem(itemId: number): void {
    this.cartService.removeFromCart(itemId, this.userId!).subscribe({
      next: () => {
        this.cartItems = this.cartItems.filter(item => item.id !== itemId);
        this.updateTotalPrice();
      },
      error: (err) => {
        console.error("Error removing item:", err);
      }
    });
  }

  // ✅ Update total price
  private updateTotalPrice(): void {
    this.totalPrice = this.cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  // ✅ Proceed to checkout
  checkout(): void {
    alert('Proceeding to checkout...');
  }
}
