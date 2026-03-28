import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { CartService, CartItem } from 'src/app/services/cart.service';
import { PromotionService } from 'src/app/services/promotion.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit {
  cartItems: CartItem[] = [];
  subtotal = 0;
  discount = 0;
  autoDiscountPercent = 0;

  get totalPrice(): number { return Math.max(0, this.subtotal - this.discount); }

  constructor(
    private cartService: CartService,
    private promotionService: PromotionService,
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
    this.promotionService.getActivePromotions().subscribe({
      next: (promos) => {
        const auto = promos.find(p => !p.code && p.appliesTo === 'ALL' && p.discountPercent);
        this.autoDiscountPercent = auto?.discountPercent ?? 0;
      },
      error: () => {}
    });

    this.cartService.getCartItems().subscribe({
      next: (items) => {
        this.cartItems = items;
        this.updateTotals();
      },
      error: () => {}
    });
  }

  private updateTotals(): void {
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.menuItemPrice * item.quantity, 0);
    this.discount = this.autoDiscountPercent ? Math.round(this.subtotal * this.autoDiscountPercent) / 100 : 0;
  }

  onQuantityChange(item: CartItem, quantity: number): void {
    item.quantity = quantity;
    this.updateTotals();
    this.cartService.updateCartItem(item.id, quantity).subscribe();
  }

  removeItem(itemId: string): void {
    this.cartService.removeFromCart(itemId).subscribe({
      next: () => {
        this.cartItems = this.cartItems.filter(item => item.id !== itemId);
        this.updateTotals();
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
