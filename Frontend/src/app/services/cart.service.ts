import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private apiUrlCart = "http://localhost:8080/api/cart";
  private cartItems = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {}

  // ✅ Load user's cart items from backend
  getCartItems(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrlCart}/${userId}`).pipe(
      tap(items => this.cartItems.next(items))
    );
  }

  // ✅ Method to add an item to the cart
  addToCart(userId: number, menuItemId: number, quantity: number): Observable<any> {
    return this.http.post(`${this.apiUrlCart}/add`, { userId, menuItemId, quantity }).pipe(
      tap(() => this.refreshCart(userId))
    );
  }
  

  // ✅ Method to update cart item quantity
  updateCartItem(cartItemId: number, quantity: number, userId: number): Observable<any> {
    return this.http.put(`${this.apiUrlCart}/update/${cartItemId}`, { quantity }).pipe(
      tap(() => this.refreshCart(userId))
    );
  }
  

  // ✅ Method to remove an item from the cart
  removeFromCart(cartItemId: number, userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrlCart}/delete/${cartItemId}`).pipe(
      tap(() => this.refreshCart(userId))
    );
  }

  // ✅ Refresh cart after an update
  private refreshCart(userId: number): void {
    this.getCartItems(userId).subscribe();
  }
}
