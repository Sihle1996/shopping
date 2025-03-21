import { Component, OnInit } from '@angular/core';
import { CartService, CartItem } from 'src/app/services/cart.service';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';

// Declare PayPal global variable
declare var paypal: any;

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit {
  cartItems: CartItem[] = [];
  totalPrice: number = 0;

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    const userId = localStorage.getItem('userId');

    if (!userId || isNaN(Number(userId)) || Number(userId) <= 0) {
      console.error("User not logged in. Redirecting to login...");
      this.router.navigate(['/login']);
      return;
    }

    this.loadCart();
  }

  loadCart(): void {
    this.cartService.getCartItems().subscribe({
      next: (items) => {
        this.cartItems = items.map((item: any) => ({
          id: Number(item.id),
          menuItemId: Number(item.menuItemId),
          menuItemName: String(item.menuItemName),
          menuItemPrice: Number(item.menuItemPrice),
          quantity: Number(item.quantity),
          totalPrice: Number(item.totalPrice),
          image: item.image || 'assets/default-food.jpg',
          size: item.size || 'M',
        }));

        this.updateTotalPrice();
      },
      error: (err) => {
        console.error("❌ Error fetching cart items:", err);
      }
    });
  }

  private updateTotalPrice(): void {
    this.totalPrice = this.cartItems.reduce((sum, item) => sum + (item.menuItemPrice * item.quantity), 0);
    this.renderPayPalButton();
  }

  renderPayPalButton(): void {
    setTimeout(() => {
      const container = document.getElementById('paypal-button-container');
      if (container) {
        container.innerHTML = '';
        paypal.Buttons({
          createOrder: (data: any, actions: any) => {
            return actions.order.create({
              purchase_units: [{
                amount: {
                  value: this.totalPrice.toFixed(2)
                }
              }]
            });
          },
          onApprove: (data: any, actions: any) => {
            return actions.order.capture().then((details: any) => {
              console.log('✅ Payment approved:', details);
              
              this.saveOrderToBackend(details);
            });
          },
          onError: (err: any) => {
            console.error('❌ PayPal Error:', err);
            alert('Payment failed. Please try again.');
          }
        }).render('#paypal-button-container');
      }
    }, 0);
  }

  private saveOrderToBackend(details: any): void {
    const token = this.authService.getToken();
  
    if (!token) {
      console.error("❌ No auth token found. Redirecting to login...");
      alert("Session expired! Please log in again.");
      this.router.navigate(['/login']);
      return;
    }
  
    const orderData = {
      userId: this.authService.getUserId(),
      items: this.cartItems.map(item => ({
        productId: item.menuItemId,
        name: item.menuItemName,
        price: item.menuItemPrice,
        quantity: item.quantity,
        size: item.size
      })),
      total: this.totalPrice,
      paymentId: details.id,
      payerId: details.payer.payer_id,
      status: details.status
    };
  
    const headers = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.trim()}`
    };
  
    this.http.post('http://localhost:8080/api/orders/place', orderData, { headers }).subscribe({
      next: () => {
        console.log('✅ Order saved to backend.');
  
        // Clear frontend + backend cart
        this.cartService.clearCart();
  
        // Delay redirection to ensure cart clears first
        setTimeout(() => this.router.navigate(['/thank-you']), 300); // 300ms delay
      },
      error: err => {
        console.error('❌ Error saving order:', err);
        if (err.status === 403) {
          alert("Session expired! Please log in again.");
          this.router.navigate(['/login']);
        } else {
          alert("Failed to save order. Please try again.");
        }
      }
    });
  }
  
  
  
  

  increaseQuantity(item: CartItem): void {
    item.quantity++;
    this.updateTotalPrice();
  }

  decreaseQuantity(item: CartItem): void {
    if (item.quantity > 1) {
      item.quantity--;
      this.updateTotalPrice();
    }
  }

  removeItem(itemId: number): void {
    this.cartService.removeFromCart(itemId).subscribe({
      next: () => {
        this.cartItems = this.cartItems.filter(item => item.id !== itemId);
        this.updateTotalPrice();
      },
      error: (err) => console.error("❌ Error removing item:", err)
    });
  }

  checkout(): void {
    alert('Proceeding to checkout...');
  }
}
