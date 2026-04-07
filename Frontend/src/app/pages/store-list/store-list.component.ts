import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
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

  constructor(
    private http: HttpClient,
    private router: Router,
    private geocoding: GeocodingService
  ) {}

  ngOnInit(): void {
    // Always start fresh — don't pre-fill from a previous session
    localStorage.removeItem('customer_lat');
    localStorage.removeItem('customer_lon');
    localStorage.removeItem('customer_address');

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length >= 3 ? this.geocoding.autocomplete(q) : Promise.resolve([]))
    ).subscribe(results => this.suggestions = results);
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
      () => {
        this.gpsLoading = false;
        this.addressError = 'Could not get your location. Please type your address.';
      },
      { timeout: 10000, enableHighAccuracy: true }
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
    return store.logoUrl.startsWith('http') ? store.logoUrl : `${environment.apiUrl}${store.logoUrl}`;
  }
}
