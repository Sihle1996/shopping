import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private apiUrlCart = "";
  private cartItems = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {
    this.loadCartItems();
  }

  // ✅ Load cart items from backend
  private loadCartItems(): void {
    this.http.get<any[]>(`${this.apiUrlCart}`).subscribe(items => {
      this.cartItems.next(items);
    });
  }

  // ✅ Method to get cart items as an observable
  getCartItems(): Observable<any[]> {
    return this.cartItems.asObservable();
  }

  // ✅ Method to add an item to the cart
  addToCart(itemId: number): Observable<any> {
    return this.http.post(`${this.apiUrlCart}/add`, { itemId });
  }

  // ✅ Method to remove an item from the cart
  removeFromCart(itemId: number): Observable<any> {
    return this.http.delete(`${this.apiUrlCart}/delete/${itemId}`);
  }

  // ✅ Method to refresh the cart after an update
  refreshCart(): void {
    this.loadCartItems();
  }
}
