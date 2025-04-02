import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CartService } from 'src/app/services/cart.service';
import { AuthService } from 'src/app/services/auth.service';
import { GeocodingService } from 'src/app/services/geocoding.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormControl } from '@angular/forms';

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

  addressSuggestions: {
    label: string;
    street?: string;
    city?: string;
    zip?: string;
    country?: string;
  }[] = [];

  addressControl = new FormControl();

  deliveryDetails = {
    fullName: '',
    address: '',
    city: '',
    zip: '',
    phone: ''
  };

  @ViewChild('addressInput') addressInputRef!: ElementRef;

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private geocodingService: GeocodingService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngAfterViewInit(): void {
    this.addressControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(query => {
        if (query && query.length > 2) {
          this.geocodingService.autocomplete(query).subscribe({
            next: suggestions => this.addressSuggestions = suggestions,
            error: () => this.addressSuggestions = []
          });
        } else {
          this.addressSuggestions = [];
        }
      });
  }

  selectAddress(suggestion: any) {
    this.deliveryDetails.address = suggestion.label;
    this.deliveryDetails.city = suggestion.city || '';
    this.addressControl.setValue(suggestion.label);
    this.addressSuggestions = [];

    if (suggestion.zip) {
      this.deliveryDetails.zip = suggestion.zip;
    } else {
      this.geocodingService.geocodeAddress(suggestion.label).subscribe({
        next: coords => this.fetchZipFromCoords(coords.lat, coords.lon),
        error: () => console.warn('Zip fallback failed')
      });
    }
  }

  fetchZipFromCoords(lat: number, lon: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    this.http.get<any>(url).subscribe({
      next: data => {
        const postcode = data?.address?.postcode;
        if (postcode) this.deliveryDetails.zip = postcode;
      },
      error: err => console.error('Reverse geocode error', err)
    });
  }

  onSubmit(): void {
    const d = this.deliveryDetails;
    if (!d.fullName || !d.address || !d.city || !d.zip || !d.phone) {
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
          container.innerHTML = '';

          paypal.Buttons({
            createOrder: (data: any, actions: any) => {
              return actions.order.create({
                purchase_units: [{
                  amount: { value: this.totalPrice.toFixed(2) }
                }]
              });
            },
            onApprove: async (data: any, actions: any) => {
              const details = await actions.order.capture();

              const orderData = {
                userId: this.authService.getUserId(),
                deliveryAddress: `${d.address}, ${d.city}, ${d.zip}, South Africa`,
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

              this.http.post('http://localhost:8080/api/orders/place', orderData, {
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${this.authService.getToken()}`
                }
              }).subscribe({
                next: () => {
                  this.cartService.clearCart();
                  this.router.navigate(['/thank-you']);
                },
                error: err => console.error('❌ Order saving failed', err)
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