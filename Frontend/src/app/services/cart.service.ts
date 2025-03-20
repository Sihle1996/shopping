import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// ✅ Define CartItem interface
export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  totalPrice: number;
  image: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private apiUrlCart = 'http://localhost:8080/api/cart';
  private cartItems = new BehaviorSubject<CartItem[]>([]);
  private totalPrice = new BehaviorSubject<number>(0);

  constructor(private http: HttpClient) {}

  // ✅ Get cart items for a user
  getCartItems(userId: number): Observable<CartItem[]> {
    return this.http.get<CartItem[]>(`${this.apiUrlCart}/${userId}`).pipe(
      tap(items => this.cartItems.next(items))
    );
  }

  // ✅ Add item to cart
  addToCart(userId: number, menuItemId: number, quantity: number): Observable<any> {
    return this.http.post(`${this.apiUrlCart}/add`, { userId, menuItemId, quantity }).pipe(
      tap(() => this.refreshCart(userId))
    );
  }

  // ✅ Update cart item quantity
  updateCartItem(cartItemId: number, quantity: number, userId: number): Observable<any> {
    return this.http.put(`${this.apiUrlCart}/update/${cartItemId}`, { quantity }).pipe(
      tap(() => this.refreshCart(userId))
    );
  }

  // ✅ Remove item from cart
  removeFromCart(cartItemId: number, userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrlCart}/delete/${cartItemId}`).pipe(
      tap(() => this.refreshCart(userId))
    );
  }

  // ✅ Refresh cart after an update
  private refreshCart(userId: number): void {
    this.getCartItems(userId).subscribe();
  }

  // ✅ Get total price as observable
  getTotalPrice(): Observable<number> {
    return this.totalPrice.asObservable();
  }
}
