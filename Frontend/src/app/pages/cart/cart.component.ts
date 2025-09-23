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
  totalPrice: number = 0;

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const userId = localStorage.getItem('userId');

    if (!userId || isNaN(Number(userId)) || Number(userId) <= 0) {
      console.error("User not logged in. Redirecting to login...");
      this.router.navigate(['/login']);
      return;
    }

    this.loadCart();
  }

  loadCart(): void {
    this.cartService.getCartItems().subscribe({
      next: (items) => {
        this.cartItems = items;
        this.updateTotalPrice();
      },
      error: (err) => {
        console.error("Error fetching cart items:", err);
      }
    });
  }

  private updateTotalPrice(): void {
    this.totalPrice = this.cartItems.reduce((sum, item) => sum + (item.menuItemPrice * item.quantity), 0);
  }

  increaseQuantity(item: CartItem): void {
    item.quantity++;
    this.updateTotalPrice();
  }

  decreaseQuantity(item: CartItem): void {
    if (item.quantity > 1) {
      item.quantity--;
      this.updateTotalPrice();
    }
  }

  removeItem(itemId: number): void {
    this.cartService.removeFromCart(itemId).subscribe({
      next: () => {
        this.cartItems = this.cartItems.filter(item => item.id !== itemId);
        this.updateTotalPrice();
      },
      error: (err) => console.error("Error removing item:", err)
    });
  }

  proceedToCheckout(): void {
    this.router.navigate(['/checkout']);
  }

  getImageUrl(path: string | null | undefined): string {
    if (!path) return 'assets/default-image.jpg';
    return path.startsWith('/images/') ? `http://localhost:8080${path}` : path;
  }
  
  
  
}
