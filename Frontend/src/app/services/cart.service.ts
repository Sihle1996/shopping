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
    const userId = this.authService.getUserId();
    if (!userId) {
      console.error("User not logged in. Cannot fetch cart items.");
      return new Observable(observer => observer.next([]));
    }

    return this.http.get<any[]>(`${this.apiUrlCart}/${userId}`, { headers: this.getAuthHeaders() }).pipe(
      tap(items => {
        console.log("📦 Cart Items from API:", items);
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
      menuItemPrice: item.menuItemPrice,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      image: item.image || 'assets/default-food.jpg',
      size: item.size || 'M' 
    }));
  }

  
  private updateTotalPrice(): void {
    const cartItems = this.cartItems.value;
    const total = cartItems.reduce((sum, item) => sum + (item.menuItemPrice * item.quantity), 0);
    this.totalPrice.next(total);
    console.log("💰 Updated Total Price:", total);
  }

  
  getTotalPrice(): Observable<number> {
    return this.totalPrice.asObservable();
  }

 
  getCartItemCount(): Observable<number> {
    return this.cartItemCount.asObservable();
  }

  
  addToCart(menuItemId: number, quantity: number, size: string): Observable<any> {
    const userId = this.authService.getUserId();
    if (!userId) {
      console.error("User not logged in. Cannot add to cart.");
      return new Observable(observer => observer.error("User not logged in."));
    }

    return this.http.post(`${this.apiUrlCart}/add`, 
      { userId, menuItemId, quantity, size },
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => this.refreshCart())
    );
}

  
  updateCartItem(cartItemId: number, quantity: number): Observable<any> {
    return this.http.put(`${this.apiUrlCart}/update/${cartItemId}`, { quantity }, { headers: this.getAuthHeaders() }).pipe(
      tap(() => this.refreshCart())
    );
  }

 
  removeFromCart(cartItemId: number): Observable<any> {
    return this.http.delete(`${this.apiUrlCart}/delete/${cartItemId}`, { headers: this.getAuthHeaders() }).pipe(
      tap(() => this.refreshCart()) 
    );
  }

  
  private refreshCart(): void {
    this.getCartItems().subscribe();
  }


  saveOrder(order: any): Observable<any> {
    return this.http.post('http://localhost:8080/api/orders', order, {
      headers: this.getAuthHeaders()
    });
  }
  

  clearCart(): void {
    const userId = this.authService.getUserId();
    if (!userId) {
      console.error("No user ID for cart clearing.");
      return;
    }
  
    this.http.delete(`http://localhost:8080/api/cart/clear/${userId}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        console.log("🧹 Backend cart cleared.");
        this.cartItems.next([]);
        this.totalPrice.next(0);
        this.cartItemCount.next(0);
      },
      error: err => {
        console.error("Failed to clear backend cart:", err);
      }
    });
  } 
}
