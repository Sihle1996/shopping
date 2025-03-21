import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface CartItem {
  id: number;
  menuItemId: number;
  menuItemName: string;
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
  private apiUrlCart = "http://localhost:8080/api/cart";
  private cartItems = new BehaviorSubject<CartItem[]>([]);
  private totalPrice = new BehaviorSubject<number>(0);
  cartItemCount = new BehaviorSubject<number>(0); // ✅ NEW: Reactive cart count

  constructor(private http: HttpClient, private authService: AuthService) {}

  // ✅ Get Authorization Headers
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // ✅ Fetch cart items and update all states (cartItems, totalPrice, cartItemCount)
  getCartItems(): Observable<CartItem[]> {
    const userId = this.authService.getUserId();
    if (!userId) {
      console.error("❌ User not logged in. Cannot fetch cart items.");
      return new Observable(observer => observer.next([]));
    }

    return this.http.get<any[]>(`${this.apiUrlCart}/${userId}`, { headers: this.getAuthHeaders() }).pipe(
      tap(items => {
        console.log("📦 Cart Items from API:", items);
        const mappedItems = this.mapCartItems(items);
        this.cartItems.next(mappedItems);
        this.updateTotalPrice();
        this.cartItemCount.next(mappedItems.length); // ✅ Update count for footer
      })
    );
  }

  // ✅ Map API response to match CartItem structure
  private mapCartItems(items: any[]): CartItem[] {
    return items.map(item => ({
      id: item.id,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItemName,
      menuItemPrice: item.menuItemPrice,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      image: item.image || 'assets/default-food.jpg',
      size: item.size || 'M' // ✅ Default size is Medium
    }));
  }

  // ✅ Update total price based on cart state
  private updateTotalPrice(): void {
    const cartItems = this.cartItems.value;
    const total = cartItems.reduce((sum, item) => sum + (item.menuItemPrice * item.quantity), 0);
    this.totalPrice.next(total);
    console.log("💰 Updated Total Price:", total);
  }

  // ✅ Expose total price as an observable
  getTotalPrice(): Observable<number> {
    return this.totalPrice.asObservable();
  }

  // ✅ Expose cart item count
  getCartItemCount(): Observable<number> {
    return this.cartItemCount.asObservable();
  }

  // ✅ Add item to cart and update states
  addToCart(menuItemId: number, quantity: number, size: string): Observable<any> {
    const userId = this.authService.getUserId();
    if (!userId) {
      console.error("❌ User not logged in. Cannot add to cart.");
      return new Observable(observer => observer.error("User not logged in."));
    }

    return this.http.post(`${this.apiUrlCart}/add`, 
      { userId, menuItemId, quantity, size }, // ✅ Add `size` to the request
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => this.refreshCart()) // ✅ Refresh cart after adding item
    );
}

  // ✅ Update cart item quantity
  updateCartItem(cartItemId: number, quantity: number): Observable<any> {
    return this.http.put(`${this.apiUrlCart}/update/${cartItemId}`, { quantity }, { headers: this.getAuthHeaders() }).pipe(
      tap(() => this.refreshCart()) // ✅ UI updates instantly
    );
  }

  // ✅ Remove item from cart
  removeFromCart(cartItemId: number): Observable<any> {
    return this.http.delete(`${this.apiUrlCart}/delete/${cartItemId}`, { headers: this.getAuthHeaders() }).pipe(
      tap(() => this.refreshCart()) // ✅ UI updates instantly
    );
  }

  // ✅ Refresh cart without needing a page refresh
  private refreshCart(): void {
    this.getCartItems().subscribe();
  }


  saveOrder(order: any): Observable<any> {
    return this.http.post('http://localhost:8080/api/orders', order, {
      headers: this.getAuthHeaders()
    });
  }
  

  clearCart(): void {
    this.cartItems.next([]);
    this.totalPrice.next(0);
  }
  
}
