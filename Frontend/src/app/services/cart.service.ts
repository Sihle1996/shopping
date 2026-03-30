import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
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
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private apiUrl = `${environment.apiUrl}/api/cart`;
  private cartItems = new BehaviorSubject<CartItem[]>([]);
  private totalPrice = new BehaviorSubject<number>(0);
  cartItemCount = new BehaviorSubject<number>(0);

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getCartItems(): Observable<CartItem[]> {
    if (!this.authService.isLoggedIn()) {
      return new Observable(observer => observer.next([]));
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
      size: item.size || 'M'
    }));
  }

  private updateTotalPrice(): void {
    const cartItems = this.cartItems.value;
    const total = cartItems.reduce((sum, item) => sum + (item.menuItemPrice * item.quantity), 0);
    this.totalPrice.next(total);
  }

  getTotalPrice(): Observable<number> {
    return this.totalPrice.asObservable();
  }

  getCartItemCount(): Observable<number> {
    return this.cartItemCount.asObservable();
  }

  addToCart(menuItemId: string, quantity: number, size: string): Observable<any> {
    if (!this.authService.isLoggedIn()) {
      return new Observable(observer => observer.error('User not logged in.'));
    }

    return this.http.post(`${this.apiUrl}/add`,
      { menuItemId, quantity, size },
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => this.refreshCart())
    );
  }

  updateCartItem(cartItemId: string, quantity: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/update/${cartItemId}`, { quantity }, { headers: this.getAuthHeaders() }).pipe(
      tap(() => this.refreshCart())
    );
  }

  removeFromCart(cartItemId: string): Observable<any> {
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
    if (!this.authService.isLoggedIn()) return;

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
