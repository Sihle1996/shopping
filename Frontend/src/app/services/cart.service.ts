import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';

export interface CartItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemCategory?: string;
  menuItemPrice: number;
  quantity: number;
  totalPrice: number;
  image?: string;
  size?: string;
  selectedChoicesJson?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private apiUrl = `${environment.apiUrl}/api/cart`;
  private cartItems = new BehaviorSubject<CartItem[]>([]);
  private totalPrice = new BehaviorSubject<number>(0);
  cartItemCount = new BehaviorSubject<number>(0);

  private LOCAL_CART_KEY = 'guest_cart';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // ── Local (guest) cart helpers ────────────────────────────────────────────

  private getLocalCart(): CartItem[] {
    try {
      const raw = localStorage.getItem(this.LOCAL_CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private saveLocalCart(items: CartItem[]): void {
    localStorage.setItem(this.LOCAL_CART_KEY, JSON.stringify(items));
    this.cartItems.next(items);
    this.updateTotalPrice();
    this.cartItemCount.next(items.length);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getCartItems(): Observable<CartItem[]> {
    if (!this.authService.isLoggedIn()) {
      const local = this.getLocalCart();
      this.cartItems.next(local);
      this.updateTotalPrice();
      this.cartItemCount.next(local.length);
      return of(local);
    }

    return this.http.get<any[]>(`${this.apiUrl}`, { headers: this.getAuthHeaders() }).pipe(
      tap(items => {
        const mappedItems = this.mapCartItems(items);
        this.cartItems.next(mappedItems);
        this.updateTotalPrice();
        this.cartItemCount.next(mappedItems.length);
      })
    );
  }

  private mapCartItems(items: any[]): CartItem[] {
    return items.map(item => ({
      id: item.id,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItemName,
      menuItemCategory: item.menuItemCategory,
      menuItemPrice: item.menuItemPrice,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      image: item.image || 'assets/placeholder.png',
      size: item.size || 'M',
      selectedChoicesJson: item.selectedChoicesJson
    }));
  }

  private updateTotalPrice(): void {
    const cartItems = this.cartItems.value;
    const total = cartItems.reduce((sum, item) => sum + (item.totalPrice ?? item.menuItemPrice * item.quantity), 0);
    this.totalPrice.next(total);
  }

  getTotalPrice(): Observable<number> {
    return this.totalPrice.asObservable();
  }

  getCartItemCount(): Observable<number> {
    return this.cartItemCount.asObservable();
  }

  addToCart(
    menuItemId: string,
    quantity: number,
    size: string,
    selectedChoicesJson?: string | null,
    itemInfo?: { name: string; price: number; category?: string; image?: string }
  ): Observable<any> {
    if (!this.authService.isLoggedIn()) {
      const cart = this.getLocalCart();
      const existing = cart.find(
        i => i.menuItemId === menuItemId && (i.selectedChoicesJson || '') === (selectedChoicesJson || '')
      );
      const modSum = selectedChoicesJson
        ? (JSON.parse(selectedChoicesJson) as any[]).reduce((s: number, c: any) => s + (c.priceModifier || 0), 0)
        : 0;
      const effectiveUnitPrice = (itemInfo?.price || 0) + modSum;
      if (existing) {
        existing.quantity += quantity;
        existing.menuItemPrice = effectiveUnitPrice;
        existing.totalPrice = effectiveUnitPrice * existing.quantity;
      } else {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString();
        cart.push({
          id,
          menuItemId,
          menuItemName: itemInfo?.name || 'Item',
          menuItemCategory: itemInfo?.category,
          menuItemPrice: effectiveUnitPrice,
          quantity,
          totalPrice: effectiveUnitPrice * quantity,
          image: itemInfo?.image || 'assets/placeholder.png',
          size,
          selectedChoicesJson: selectedChoicesJson || undefined
        });
      }
      this.saveLocalCart(cart);
      return of(null);
    }

    const body: any = { menuItemId, quantity, size };
    if (selectedChoicesJson) body.selectedChoicesJson = selectedChoicesJson;

    return this.http.post(`${this.apiUrl}/add`, body, { headers: this.getAuthHeaders() }).pipe(
      tap(() => this.refreshCart())
    );
  }

  updateCartItem(cartItemId: string, quantity: number): Observable<any> {
    if (!this.authService.isLoggedIn()) {
      const cart = this.getLocalCart();
      const item = cart.find(i => i.id === cartItemId);
      if (item) {
        item.quantity = quantity;
        item.totalPrice = item.menuItemPrice * quantity;
      }
      this.saveLocalCart(cart);
      return of(null);
    }
    return this.http.put(`${this.apiUrl}/update/${cartItemId}`, { quantity }, { headers: this.getAuthHeaders() }).pipe(
      tap(() => this.refreshCart())
    );
  }

  removeFromCart(cartItemId: string): Observable<any> {
    if (!this.authService.isLoggedIn()) {
      const cart = this.getLocalCart().filter(i => i.id !== cartItemId);
      this.saveLocalCart(cart);
      return of(null);
    }
    return this.http.delete(`${this.apiUrl}/delete/${cartItemId}`, { headers: this.getAuthHeaders() }).pipe(
      tap(() => this.refreshCart())
    );
  }

  private refreshCart(): void {
    this.getCartItems().subscribe();
  }

  saveOrder(order: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/api/orders`, order, {
      headers: this.getAuthHeaders()
    });
  }

  clearCart(): void {
    if (!this.authService.isLoggedIn()) {
      localStorage.removeItem(this.LOCAL_CART_KEY);
      this.cartItems.next([]);
      this.totalPrice.next(0);
      this.cartItemCount.next(0);
      return;
    }

    this.http.delete(`${this.apiUrl}/clear`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.cartItems.next([]);
        this.totalPrice.next(0);
        this.cartItemCount.next(0);
      }
    });
  }
}
