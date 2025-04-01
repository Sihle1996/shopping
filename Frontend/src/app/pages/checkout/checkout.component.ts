import { Component, AfterViewInit } from '@angular/core';
import { CartService } from 'src/app/services/cart.service';
import { AuthService } from 'src/app/services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

declare var paypal: any;

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements AfterViewInit {
  cartItems: any[] = [];
  totalPrice: number = 0;
  showPayPal: boolean = false;

  deliveryDetails = {
    fullName: '',
    address: '',
    city: '',
    zip: '',
    phone: ''
  };

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngAfterViewInit(): void {
    // PayPal button will be rendered after delivery form is submitted
  }

  onSubmit(): void {
    if (!this.deliveryDetails.fullName || !this.deliveryDetails.address || !this.deliveryDetails.city || !this.deliveryDetails.zip || !this.deliveryDetails.phone) {
      alert("Please fill in all delivery fields.");
      return;
    }

    this.cartService.getCartItems().subscribe(items => {
      this.cartItems = items;
      this.totalPrice = items.reduce((sum, item) => sum + item.menuItemPrice * item.quantity, 0);
      this.showPayPal = true;

      setTimeout(() => {
        const container = document.getElementById('paypal-button-container');
        if (container) {
          container.innerHTML = ''; // clear previous button if any
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
            onApprove: async (data: any, actions: any) => {
              const details = await actions.order.capture();
              console.log('✅ Payment successful!', details);

              // 📦 Format address for geocoding and display
              const deliveryAddressForGeocoding = `${this.deliveryDetails.address}, ${this.deliveryDetails.city}, ${this.deliveryDetails.zip}, South Africa`;

              const orderData = {
                userId: this.authService.getUserId(),
                deliveryAddress: deliveryAddressForGeocoding,
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
                'Authorization': `Bearer ${this.authService.getToken()}`
              };

              this.http.post('http://localhost:8080/api/orders/place', orderData, { headers }).subscribe({
                next: () => {
                  console.log('✅ Order placed and cart cleared');
                  this.cartService.clearCart();
                  this.router.navigate(['/thank-you']);
                },
                error: (err) => {
                  console.error('❌ Error saving order:', err);
                }
              });
            },
            onError: (err: any) => {
              console.error('❌ Payment error', err);
            }
          }).render('#paypal-button-container');
        }
      }, 0);
    });
  }
}
