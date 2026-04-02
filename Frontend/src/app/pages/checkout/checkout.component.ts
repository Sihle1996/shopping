import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';
import { CartService } from 'src/app/services/cart.service';
import { AuthService } from 'src/app/services/auth.service';
import { GeocodingService } from 'src/app/services/geocoding.service';
import { PromotionService, Promotion } from 'src/app/services/promotion.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';
import { AddressService, UserAddress } from 'src/app/services/address.service';

declare var paypal: any;

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit, AfterViewInit {
  cartItems: any[] = [];
  subtotal: number = 0;
  discount: number = 0;
  get totalPrice(): number { return Math.max(0, this.subtotal - this.discount); }

  showPayPal: boolean = false;

  // Promo code
  promoCode: string = '';
  promoLoading = false;
  appliedPromo: Promotion | null = null;
  promoError: string = '';

  locating = false;
  private selectedLat: number | null = null;
  private selectedLon: number | null = null;

  addressSuggestions: {
    label: string;
    street?: string;
    city?: string;
    zip?: string;
    country?: string;
  }[] = [];

  addressControl = new FormControl();

  orderNotes = '';
  isLoggedIn = false;

  // Guest checkout fields (shown when not logged in)
  guestEmail = '';
  guestPhone = '';

  deliveryDetails = {
    fullName: '',
    address: '',
    city: '',
    zip: '',
    phone: ''
  };

  @ViewChild('addressInput') addressInputRef!: ElementRef;

  savedAddresses: UserAddress[] = [];
  showAddressPicker = false;

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private geocodingService: GeocodingService,
    private promotionService: PromotionService,
    private http: HttpClient,
    private router: Router,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef,
    private addressService: AddressService
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.loadCartAndPromos();
    if (this.isLoggedIn) {
      this.addressService.list().subscribe({
        next: addresses => {
          this.savedAddresses = addresses;
          const def = addresses.find(a => a.isDefault);
          if (def) this.fillFromSaved(def);
        }
      });
    }
  }

  fillFromSaved(a: UserAddress): void {
    this.deliveryDetails.address = a.street;
    this.deliveryDetails.city = a.city;
    this.deliveryDetails.zip = a.postalCode ?? '';
    this.addressControl.setValue(a.street, { emitEvent: false });
    if (a.latitude && a.longitude) {
      (this as any).selectedLat = a.latitude;
      (this as any).selectedLon = a.longitude;
    }
    this.showAddressPicker = false;
  }

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

  private loadCartAndPromos(): void {
    // Load promos first, then cart — guarantees both are set before recalcDiscount()
    this.promotionService.getActivePromotions().pipe(
      switchMap(promos => {
        if (!this.appliedPromo) {
          // Auto-apply best no-code promo: ALL first, then PRODUCT if item is in cart
          const autoAll = promos.find(p => !p.code && p.appliesTo === 'ALL' && p.discountPercent);
          if (autoAll) {
            this.appliedPromo = autoAll;
          } else {
            // PRODUCT and CATEGORY promos — will be re-evaluated after cart loads
            const autoOther = promos.filter(p => !p.code && p.discountPercent &&
              (p.appliesTo === 'PRODUCT' || p.appliesTo === 'CATEGORY'));
            if (autoOther.length) this.appliedPromo = autoOther[0];
          }
        }
        return this.cartService.getCartItems();
      })
    ).subscribe({
      next: (items) => {
        this.cartItems = items;
        this.subtotal = items.reduce((sum, item) => sum + item.menuItemPrice * item.quantity, 0);
        this.recalcDiscount();
        this.cdr.detectChanges();
      },
      error: () => {
        this.cartService.getCartItems().subscribe(items => {
          this.cartItems = items;
          this.subtotal = items.reduce((sum, item) => sum + item.menuItemPrice * item.quantity, 0);
        });
      }
    });
  }

  private recalcDiscount(): void {
    if (!this.appliedPromo || !this.appliedPromo.discountPercent) {
      this.discount = 0;
      return;
    }
    const pct = this.appliedPromo.discountPercent / 100;
    if (this.appliedPromo.appliesTo === 'ALL') {
      this.discount = this.subtotal * pct;
    } else if (this.appliedPromo.appliesTo === 'PRODUCT' && this.appliedPromo.targetProductId) {
      this.discount = this.cartItems
        .filter(i => i.menuItemId === this.appliedPromo!.targetProductId)
        .reduce((sum, i) => sum + i.menuItemPrice * i.quantity * pct, 0);
    } else if (this.appliedPromo.appliesTo === 'CATEGORY' && this.appliedPromo.targetCategoryName) {
      const catName = this.appliedPromo.targetCategoryName.toLowerCase();
      this.discount = this.cartItems
        .filter((i: any) => (i.menuItemCategory ?? '').toLowerCase() === catName)
        .reduce((sum: number, i: any) => sum + i.menuItemPrice * i.quantity * pct, 0);
    } else {
      this.discount = 0; // can't apply — unknown scope
    }
    this.discount = Math.round(this.discount * 100) / 100;
  }

  applyPromoCode(): void {
    const code = this.promoCode.trim();
    if (!code) return;

    this.promoLoading = true;
    this.promoError = '';
    this.appliedPromo = null;
    this.discount = 0;

    this.promotionService.validateCode(code).subscribe({
      next: (promo) => {
        this.appliedPromo = promo;
        this.recalcDiscount();
        this.cdr.detectChanges();
        this.promoLoading = false;
        if (this.discount > 0) {
          this.toastr.success(`"${promo.title}" applied — ${promo.discountPercent}% off!`);
        } else {
          this.toastr.info(`"${promo.title}" applied`);
        }
      },
      error: () => {
        this.promoError = 'Invalid or expired promo code';
        this.promoLoading = false;
      }
    });
  }

  removePromo(): void {
    this.appliedPromo = null;
    this.promoCode = '';
    this.promoError = '';
    this.discount = 0;
  }

  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.toastr.warning('Geolocation is not supported by your browser');
      return;
    }
    this.locating = true;

    // Use watchPosition to wait for a high-accuracy fix (accuracy < 50m)
    // then stop watching and reverse geocode
    let watchId: number;
    const done = (pos: GeolocationPosition) => {
      navigator.geolocation.clearWatch(watchId);
      this.resolveLocation(pos);
    };
    watchId = navigator.geolocation.watchPosition(
      pos => {
        if (pos.coords.accuracy <= 50) {
          done(pos); // accurate enough
        }
        // else keep watching for a better fix
      },
      () => {
        navigator.geolocation.clearWatch(watchId);
        this.locating = false;
        this.toastr.warning('Location access denied. Please type your address manually.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Safety timeout — use whatever we have after 8 seconds
    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      if (this.locating) {
        navigator.geolocation.getCurrentPosition(
          pos => this.resolveLocation(pos),
          () => { this.locating = false; },
          { enableHighAccuracy: true, maximumAge: 0 }
        );
      }
    }, 8000);
  }

  private resolveLocation(pos: GeolocationPosition): void {
    this.selectedLat = pos.coords.latitude;
    this.selectedLon = pos.coords.longitude;
    this.geocodingService.reverseGeocode(pos.coords.latitude, pos.coords.longitude).subscribe({
      next: (result) => {
        const a = result.address;
        const road = a.road || a.pedestrian || a.footway || '';
        const suburb = a.suburb || a.neighbourhood || a.quarter || '';
        const city = a.city || a.town || a.village || a.county || '';
        const postcode = a.postcode || '';
        const displayName = [road, suburb, city].filter(Boolean).join(', ');
        this.deliveryDetails.address = displayName;
        this.deliveryDetails.city = city;
        this.addressControl.setValue(displayName, { emitEvent: false });
        this.addressSuggestions = [];

        if (postcode) {
          this.deliveryDetails.zip = postcode;
          this.locating = false;
          this.cdr.detectChanges();
        } else {
          this.geocodingService.reverseGeocodeMapbox(pos.coords.latitude, pos.coords.longitude).subscribe({
            next: (zip) => {
              this.deliveryDetails.zip = zip;
              this.locating = false;
              this.cdr.detectChanges();
            },
            error: () => {
              this.locating = false;
              this.cdr.detectChanges();
            }
          });
        }
      },
      error: () => {
        this.locating = false;
        this.toastr.error('Could not determine your address');
      }
    });
  }

  selectAddress(suggestion: any) {
    // Store exact coordinates from the autocomplete result — no re-geocoding needed
    this.selectedLat = suggestion.lat;
    this.selectedLon = suggestion.lon;

    this.deliveryDetails.address = suggestion.label;
    this.deliveryDetails.city = suggestion.city || '';
    this.deliveryDetails.zip = suggestion.zip || '';
    this.addressControl.setValue(suggestion.label, { emitEvent: false });
    this.addressSuggestions = [];
  }

  cleanAddressLabel(label: string): string {
    const ignoreWords = ['GT', 'Gauteng', 'South Africa', 'RSA'];
    const parts = label
      .split(',')
      .map(p => p.trim())
      .filter((part, index, arr) =>
        part &&
        arr.indexOf(part) === index &&
        !ignoreWords.includes(part) &&
        !/^\d{4,5}$/.test(part)
      );
    return parts.join(', ');
  }

  sanitizeAddress(...parts: string[]): string {
    return parts
      .filter(Boolean)
      .map(p => p.trim())
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .join(', ');
  }

  onSubmit(): void {
    const d = this.deliveryDetails;
    if (!d.address || !d.city || !d.zip || !d.phone) {
      this.toastr.warning('Please fill in all delivery fields');
      return;
    }
    if (!this.isLoggedIn) {
      if (!this.guestEmail || !this.guestEmail.includes('@')) {
        this.toastr.warning('Please enter a valid email address');
        return;
      }
    }

    this.cartService.getCartItems().subscribe(items => {
      this.cartItems = items;
      this.subtotal = items.reduce((sum, item) => sum + item.menuItemPrice * item.quantity, 0);
      this.recalcDiscount();
      this.showPayPal = true;
      this.cdr.detectChanges();

      this.loadPayPalScript().then(() => {
        const container = document.getElementById('paypal-button-container');
        if (!container) return;
        container.innerHTML = '';

        (window as any)['paypal'].Buttons({
          createOrder: (_data: any, actions: any) => {
            return actions.order.create({
              purchase_units: [{ amount: { value: this.totalPrice.toFixed(2) } }]
            });
          },
          onApprove: async (_data: any, actions: any) => {
            const details = await actions.order.capture();

            const orderData: any = {
              userId: this.isLoggedIn ? this.authService.getUserId() : null,
              guestEmail: !this.isLoggedIn ? this.guestEmail.trim() : null,
              guestPhone: !this.isLoggedIn ? (this.guestPhone.trim() || this.deliveryDetails.phone) : null,
              deliveryAddress: `${d.address}, ${d.city}, ${d.zip}, South Africa`,
              deliveryLat: this.selectedLat,
              deliveryLon: this.selectedLon,
              items: this.cartItems.map(item => ({
                productId: item.menuItemId,
                name: item.menuItemName,
                price: item.menuItemPrice,
                quantity: item.quantity,
                size: item.size,
                selectedChoices: (item as any).selectedChoicesJson
                  ? JSON.parse((item as any).selectedChoicesJson)
                  : null
              })),
              total: this.subtotal,
              promoCode: this.appliedPromo?.code?.trim() || null,
              orderNotes: this.orderNotes?.trim() || null,
              paymentId: details.id,
              payerId: details.payer.payer_id,
              status: details.status
            };

            const headers: any = { 'Content-Type': 'application/json' };
            const token = this.authService.getToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const tenantId = localStorage.getItem('tenantId');
            if (tenantId) headers['X-Tenant-Id'] = tenantId;

            this.http.post(`${environment.apiUrl}/api/orders/place`, orderData, { headers }).subscribe({
              next: () => {
                this.cartService.clearCart();
                this.toastr.success('Order placed successfully!');
                const slug = localStorage.getItem('storeSlug');
                this.router.navigate(slug ? ['/store', slug, 'thank-you'] : ['/thank-you']);
              },
              error: () => this.toastr.error('Failed to place order. Please try again.')
            });
          },
          onError: () => this.toastr.error('Payment failed. Please try again.')
        }).render('#paypal-button-container');
      }).catch(() => this.toastr.error('Could not load PayPal. Check your connection.'));
    });
  }

  private loadPayPalScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any)['paypal']) { resolve(); return; }
      const existing = document.getElementById('paypal-sdk');
      if (existing) { existing.addEventListener('load', () => resolve()); return; }
      const script = document.createElement('script');
      script.id = 'paypal-sdk';
      script.src = 'https://www.paypal.com/sdk/js?client-id=AQu3J8gnpoX5_Zy-JvKacc3L4kxMnLillZicsDvZePl0R5GG4RpX7xgENhm_6GotQiNTrFxDAYnGGTwR&currency=USD';
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.body.appendChild(script);
    });
  }
}
