import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { CartService, CartItem } from 'src/app/services/cart.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit {
  cartItems: CartItem[] = [];
  totalPrice = 0;

  constructor(
    private cartService: CartService,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) {
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
      error: () => {}
    });
  }

  private updateTotalPrice(): void {
    this.totalPrice = this.cartItems.reduce(
      (sum, item) => sum + item.menuItemPrice * item.quantity, 0
    );
  }

  onQuantityChange(item: CartItem, quantity: number): void {
    item.quantity = quantity;
    this.updateTotalPrice();
    this.cartService.updateCartItem(item.id, quantity).subscribe();
  }

  removeItem(itemId: string): void {
    this.cartService.removeFromCart(itemId).subscribe({
      next: () => {
        this.cartItems = this.cartItems.filter(item => item.id !== itemId);
        this.updateTotalPrice();
      }
    });
  }

  proceedToCheckout(): void {
    const slug = localStorage.getItem('storeSlug');
    this.router.navigate(slug ? ['/store', slug, 'checkout'] : ['/checkout']);
  }

  goBack(): void {
    this.location.back();
  }

  goToMenu(): void {
    const slug = localStorage.getItem('storeSlug');
    this.router.navigate(slug ? ['/store', slug] : ['/']);
  }

  getImageUrl(path: string | null | undefined): string {
    if (!path) return 'assets/placeholder.png';
    return path.startsWith('http') ? path : `${environment.apiUrl}${path}`;
  }

  trackById(_: number, item: CartItem): string {
    return item.id;
  }
}
