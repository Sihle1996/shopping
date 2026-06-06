import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { cloudinaryUrl } from 'src/app/shared/utils/cloudinary.util';
import { GeocodingService } from '../../services/geocoding.service';

interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
  address?: string;
  phone?: string;
  distanceKm?: number;
  deliveryRadiusKm?: number;
  estimatedDeliveryMinutes?: number;
  cuisineType?: string;
  isOpen?: boolean;
}

interface AddressSuggestion {
  label: string;
  lat: number;
  lon: number;
}

@Component({
  selector: 'app-store-list',
  templateUrl: './store-list.component.html',
  styleUrls: ['./store-list.component.scss']
})
export class StoreListComponent implements OnInit, OnDestroy {
  step: 'address' | 'stores' = 'address';

  // Address step
  addressInput = '';
  suggestions: AddressSuggestion[] = [];
  selectedAddress = '';
  selectedLat: number | null = null;
  selectedLon: number | null = null;
  gpsLoading = false;
  addressError = '';
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Stores step
  stores: StoreSummary[] = [];
  isLoading = false;
  storesError = '';
  selectedCuisine = 'All';

  get cuisineTypes(): string[] {
    const types = this.stores
      .map(s => s.cuisineType)
      .filter((c): c is string => !!c);
    return ['All', ...Array.from(new Set(types)).sort()];
  }

  get filteredStores(): StoreSummary[] {
    if (this.selectedCuisine === 'All') return this.stores;
    return this.stores.filter(s => s.cuisineType === this.selectedCuisine);
  }

  selectCuisine(cuisine: string): void {
    this.selectedCuisine = cuisine;
  }

  constructor(
    private http: HttpClient,
    private router: Router,
    private geocoding: GeocodingService
  ) {}

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length >= 3 ? this.geocoding.autocomplete(q) : Promise.resolve([]))
    ).subscribe(results => this.suggestions = results);

    // Pre-fill the address field from last session but don't auto-search —
    // location may have changed, so the user must confirm with "Find Stores" or GPS
    const savedAddress = localStorage.getItem('customer_address');
    if (savedAddress) {
      this.addressInput = savedAddress;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onAddressInput(): void {
    this.selectedLat = null;
    this.selectedLon = null;
    this.suggestions = [];
    if (this.addressInput.length >= 3) {
      this.searchSubject.next(this.addressInput);
    }
  }

  selectSuggestion(s: AddressSuggestion): void {
    this.addressInput = s.label;
    this.selectedAddress = s.label;
    this.selectedLat = s.lat;
    this.selectedLon = s.lon;
    this.suggestions = [];
  }

  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.addressError = 'Geolocation is not supported by your browser.';
      return;
    }
    if (!window.isSecureContext) {
      this.addressError = 'Location needs a secure (https) connection. Please type your address.';
      return;
    }
    this.gpsLoading = true;
    this.addressError = '';
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.selectedLat = pos.coords.latitude;
        this.selectedLon = pos.coords.longitude;
        this.gpsLoading = false;
        this.geocoding.reverseGeocode(this.selectedLat, this.selectedLon).subscribe({
          next: (res: any) => {
            this.addressInput = res.display_name || 'Current location';
            this.selectedAddress = this.addressInput;
            this.saveAndLoad();
          },
          error: () => {
            this.addressInput = 'Current location';
            this.selectedAddress = this.addressInput;
            this.saveAndLoad();
          }
        });
      },
      (err) => {
        this.gpsLoading = false;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            this.addressError = 'Location access is blocked. Enable it in your browser settings, or type your address below.';
            break;
          case err.POSITION_UNAVAILABLE:
            this.addressError = 'Your location is unavailable right now. Please type your address below.';
            break;
          case err.TIMEOUT:
            this.addressError = 'Getting your location took too long. Try again, or type your address below.';
            break;
          default:
            this.addressError = 'Could not get your location. Please type your address below.';
        }
      },
      // Rough location is enough to find nearby stores. Low accuracy is much
      // faster and far less likely to time out on mobile; allow a recent
      // cached fix and give the device a generous window before timing out.
      { timeout: 20000, enableHighAccuracy: false, maximumAge: 300000 }
    );
  }

  confirmAddress(): void {
    if (!this.addressInput.trim()) return;
    this.addressError = '';

    if (this.selectedLat !== null && this.selectedLon !== null) {
      this.saveAndLoad();
      return;
    }

    this.isLoading = true;
    this.geocoding.geocodeAddress(this.addressInput).subscribe({
      next: ({ lat, lon }) => {
        this.selectedLat = lat;
        this.selectedLon = lon;
        this.selectedAddress = this.addressInput;
        this.saveAndLoad();
      },
      error: () => {
        this.isLoading = false;
        this.addressError = 'Address not found. Please try a more specific address.';
      }
    });
  }

  changeLocation(): void {
    this.step = 'address';
    this.stores = [];
    this.suggestions = [];
    this.addressError = '';
    this.selectedCuisine = 'All';
    localStorage.removeItem('customer_lat');
    localStorage.removeItem('customer_lon');
    localStorage.removeItem('customer_address');
  }

  private saveAndLoad(): void {
    localStorage.setItem('customer_lat', String(this.selectedLat));
    localStorage.setItem('customer_lon', String(this.selectedLon));
    localStorage.setItem('customer_address', this.selectedAddress);
    this.loadNearbyStores();
  }

  private loadNearbyStores(): void {
    this.isLoading = true;
    this.storesError = '';
    this.step = 'stores';
    this.http
      .get<StoreSummary[]>(
        `${environment.apiUrl}/api/tenants/nearby?lat=${this.selectedLat}&lon=${this.selectedLon}`
      )
      .subscribe({
        next: stores => {
          this.stores = stores;
          this.isLoading = false;
        },
        error: () => {
          this.storesError = 'Could not load nearby stores. Please try again.';
          this.isLoading = false;
        }
      });
  }

  goToStore(slug: string): void {
    if (!slug) return;
    this.router.navigate(['/store', slug]);
  }

  getLogoUrl(store: StoreSummary): string {
    if (!store.logoUrl) return '';
    const full = store.logoUrl.startsWith('http') ? store.logoUrl : `${environment.apiUrl}${store.logoUrl}`;
    return cloudinaryUrl(full, 200);
  }
}
