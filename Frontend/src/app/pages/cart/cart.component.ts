import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { CartService, CartItem } from 'src/app/services/cart.service';
import { PromotionService, Promotion } from 'src/app/services/promotion.service';
import { ToastrService } from 'ngx-toastr';
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
  activePromotions: Promotion[] = [];
  bestPromo: Promotion | null = null;

  get autoDiscountPercent(): number { return this.bestPromo?.discountPercent ?? 0; }
  get totalPrice(): number { return Math.max(0, this.subtotal - this.discount); }

  constructor(
    private cartService: CartService,
    private promotionService: PromotionService,
    private router: Router,
    private location: Location,
    private toastr: ToastrService
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
    this.promotionService.getActivePromotions().pipe(
      switchMap(promos => {
        this.activePromotions = promos;
        return this.cartService.getCartItems();
      })
    ).subscribe({
      next: (items) => { this.cartItems = items; this.updateTotals(); },
      error: () => { this.cartService.getCartItems().subscribe(items => { this.cartItems = items; this.updateTotals(); }); }
    });
  }

  private updateTotals(): void {
    this.subtotal = this.cartItems.reduce((sum, item) => sum + (item.totalPrice ?? item.menuItemPrice * item.quantity), 0);
    this.bestPromo = this.pickBestPromo();
    if (!this.bestPromo || !this.bestPromo.discountPercent) { this.discount = 0; return; }
    const pct = this.bestPromo.discountPercent / 100;
    if (this.bestPromo.appliesTo === 'ALL') {
      this.discount = Math.round(this.subtotal * pct * 100) / 100;
    } else if (this.bestPromo.appliesTo === 'PRODUCT' && this.bestPromo.targetProductId) {
      this.discount = Math.round(
        this.cartItems
          .filter(i => i.menuItemId === this.bestPromo!.targetProductId)
          .reduce((sum, i) => sum + i.menuItemPrice * i.quantity * pct, 0) * 100
      ) / 100;
    } else if (this.bestPromo.appliesTo === 'CATEGORY' && this.bestPromo.targetCategoryName) {
      const catName = this.bestPromo.targetCategoryName.toLowerCase();
      this.discount = Math.round(
        this.cartItems
          .filter(i => (i.menuItemCategory ?? '').toLowerCase() === catName)
          .reduce((sum, i) => sum + i.menuItemPrice * i.quantity * pct, 0) * 100
      ) / 100;
    } else {
      this.discount = 0;
    }
  }

  private pickBestPromo(): Promotion | null {
    const auto = this.activePromotions.filter(p => !p.code && p.discountPercent);
    if (!auto.length) return null;
    const allPromo = auto.find(p => p.appliesTo === 'ALL');
    const productPromos = auto.filter(p => p.appliesTo === 'PRODUCT' &&
      this.cartItems.some(i => i.menuItemId === p.targetProductId));
    const categoryPromos = auto.filter(p => p.appliesTo === 'CATEGORY' && p.targetCategoryName &&
      this.cartItems.some(i => (i.menuItemCategory ?? '').toLowerCase() === p.targetCategoryName!.toLowerCase()));
    const candidates = [...(allPromo ? [allPromo] : []), ...productPromos, ...categoryPromos];
    if (!candidates.length) return null;
    return candidates.reduce((best, p) =>
      (p.discountPercent ?? 0) > (best.discountPercent ?? 0) ? p : best
    );
  }

  onQuantityChange(item: CartItem, quantity: number): void {
    item.quantity = quantity;
    this.updateTotals();
    this.cartService.updateCartItem(item.id, quantity).subscribe();
  }

  clearAll(): void {
    this.cartService.clearCart();
    this.cartItems = [];
    this.updateTotals();
    this.toastr.success('Cart cleared');
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
    const slug = localStorage.getItem('storeSlug');
    this.router.navigate(slug ? ['/store', slug] : ['/stores']);
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
