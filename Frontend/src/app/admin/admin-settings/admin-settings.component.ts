import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { driver } from 'driver.js';
import { AuthService } from 'src/app/services/auth.service';
import { TenantService } from 'src/app/services/tenant.service';
import { AdminService } from 'src/app/services/admin.service';
import { NotificationService } from 'src/app/services/notification.service';
import { SubscriptionService } from 'src/app/services/subscription.service';
import { GeocodingService, AddressSuggestion } from 'src/app/services/geocoding.service';
import { ToastrService } from 'ngx-toastr';
import { ConfirmService } from 'src/app/shared/services/confirm.service';
import { TabItem } from 'src/app/shared/components/tabbed-list/tabbed-list.component';
import { environment } from 'src/environments/environment';

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  primaryColor: string;
  coverImageUrl: string;
  storeDescription: string;
  instagramUrl: string;
  facebookUrl: string;
  websiteUrl: string;
  phone: string;
  email: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  deliveryRadiusKm: number;
  deliveryFeeBase: number;
  isOpen: boolean;
  minimumOrderAmount: number | null;
  estimatedDeliveryMinutes: number;
  autoCancelMinutes: number;
  cuisineType: string;
  driverEarningPercent: number;
}

@Component({
  selector: 'app-admin-settings',
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.scss']
})
export class AdminSettingsComponent implements OnInit, OnDestroy {
  settings: TenantSettings = {
    id: '',
    name: '',
    slug: '',
    logoUrl: '',
    primaryColor: '#E76F51',
    coverImageUrl: '',
    storeDescription: '',
    instagramUrl: '',
    facebookUrl: '',
    websiteUrl: '',
    phone: '',
    email: '',
    address: '',
    latitude: null,
    longitude: null,
    deliveryRadiusKm: 10,
    deliveryFeeBase: 0,
    isOpen: true,
    minimumOrderAmount: null,
    estimatedDeliveryMinutes: 30,
    autoCancelMinutes: 15,
    cuisineType: '',
    driverEarningPercent: 10
  };
  isLoading = false;
  isSaving = false;
  settingsEditing = false;  // store profile/branding/delivery stay read-only until Edit

  /** Section tabs — break the long settings page into focused groups (no Save logic touched). */
  settingsTab = 'store';
  settingsTabs: TabItem[] = [
    { key: 'store', label: 'Store' },
    { key: 'delivery', label: 'Delivery' },
    { key: 'hours', label: 'Hours' },
    { key: 'branding', label: 'Branding' },
    { key: 'notifications', label: 'Notifications' },
  ];
  /** The Edit/Save-Settings flow only applies to the fieldset tabs (Store/Delivery/Branding). */
  get isStoreSettingsTab(): boolean {
    return this.settingsTab === 'store' || this.settingsTab === 'delivery' || this.settingsTab === 'branding';
  }
  isUploadingLogo = false;
  settingsSubmitted = false;

  addressSuggestions: AddressSuggestion[] = [];
  addressLoading = false;
  showAddressSuggestions = false;
  locating = false;
  private addressDebounce: any;

  get settingsEmailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.settings.email?.trim() || '');
  }

  hasCustomBranding = false;
  subscriptionPlan = '';

  categories: any[] = [];
  newCategoryName = '';
  savingCategory = false;
  removingCategoryId: string | null = null;

  // Store hours
  storeHours: Array<{ id: string | null; dayOfWeek: number; openTime: string; closeTime: string; closed: boolean }> = [];
  hoursLoading = false;
  hoursSaving = false;
  readonly DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Notification preferences
  notifPrefs = {
    emailOnNewOrder: true,
    emailOnCancellation: true,
    emailOnDriverAssigned: false,
    toastOnNewOrder: true,
    toastOnStatusChange: true
  };
  notifPrefsLoading = false;
  notifPrefsSaving = false;
  notifEditing = false;  // prefs stay read-only until Edit

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private tenantService: TenantService,
    private adminService: AdminService,
    private subscriptionService: SubscriptionService,
    private geocodingService: GeocodingService,
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private confirm: ConfirmService,
    private notif: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadCategories();
    this.loadStoreHours();
    this.loadNotifPrefs();
    this.subscriptionService.load().subscribe(info => {
      this.hasCustomBranding = info.features.hasCustomBranding;
      this.subscriptionPlan = info.plan;
    });
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab) this.settingsTab = tab;
    const tour = this.route.snapshot.queryParamMap.get('tour');
    if (tour) { setTimeout(() => this.runTour(tour!), 600); }
  }

  private runTour(param: string): void {
    const map: Record<string, [string, string, string]> = {
      'store-info': ['store-info-section', 'Store Information',  'Fill in your phone number and address here'],
      'logo':       ['logo-upload-section', 'Upload Your Logo',  'Click "Choose File" to upload your restaurant logo'],
      'delivery':   ['delivery-section',    'Delivery Settings', 'Set your delivery fee and radius to start receiving orders'],
      'category':   ['category-section',    'Menu Categories',   "Add your first category — you'll need it to add menu items"],
    };
    const entry = map[param];
    if (!entry) return;
    const [id, title, desc] = entry;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const d = driver({
        animate: true,
        overlayOpacity: 0.4,
        allowClose: true,
        overlayClickBehavior: 'close',
        onDestroyed: () => { this.activeDriver = null; }
      });
      this.activeDriver = d;
      d.highlight({ element: '#' + id, popover: { title, description: desc, side: 'bottom', align: 'start', showButtons: ['close'] } });
    }, 650);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authService.getToken()}`
    });
  }

  loadSettings(): void {
    this.isLoading = true;
    // The tenant ID comes from JWT — backend resolves it
    this.http.get<TenantSettings>(`${environment.apiUrl}/api/admin/settings`, {
      headers: this.getHeaders()
    }).subscribe({
      next: (data) => {
        this.settings = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error('Failed to load store settings');
      }
    });
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isUploadingLogo = true;
    const formData = new FormData();
    formData.append('file', file);

    this.http.post<{ imageUrl: string }>(`${environment.apiUrl}/api/admin/menu/upload-image`, formData, {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${this.authService.getToken()}`
      })
    }).subscribe({
      next: (res) => {
        this.settings.logoUrl = res.imageUrl;
        this.isUploadingLogo = false;
        this.toastr.success('Logo uploaded');
      },
      error: () => {
        this.isUploadingLogo = false;
        this.toastr.error('Failed to upload logo');
      }
    });
  }

  getLogoUrl(): string {
    if (!this.settings.logoUrl) return '';
    return this.settings.logoUrl.startsWith('http')
      ? this.settings.logoUrl
      : `${environment.apiUrl}${this.settings.logoUrl}`;
  }

  isUploadingCover = false;
  readonly suggestedColors = ['#E76F51', '#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#1F2937'];

  onCoverSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.isUploadingCover = true;
    const formData = new FormData();
    formData.append('file', file);
    this.http.post<{ imageUrl: string }>(`${environment.apiUrl}/api/admin/menu/upload-image`, formData, {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.getToken()}` })
    }).subscribe({
      next: (res) => { this.settings.coverImageUrl = res.imageUrl; this.isUploadingCover = false; this.toastr.success('Cover photo uploaded'); },
      error: () => { this.isUploadingCover = false; this.toastr.error('Failed to upload cover photo'); }
    });
  }

  getCoverUrl(): string {
    if (!this.settings.coverImageUrl) return '';
    return this.settings.coverImageUrl.startsWith('http')
      ? this.settings.coverImageUrl
      : `${environment.apiUrl}${this.settings.coverImageUrl}`;
  }

  /** True when the brand colour is so light that white text/buttons on it would be hard to read. */
  brandColorTooLight(): boolean {
    const hex = (this.settings.primaryColor || '').replace('#', '');
    if (hex.length !== 6) return false;
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;   // perceived luminance 0..1
    return lum > 0.7;
  }

  /** Per-device new-order sound toggle (localStorage; NotificationService reads the same key). */
  get newOrderSound(): boolean { return localStorage.getItem('newOrderSound') !== 'off'; }
  set newOrderSound(on: boolean) { localStorage.setItem('newOrderSound', on ? 'on' : 'off'); }

  /** Per-device new-order sound choice (5 options) + preview. */
  get soundOptions(): string[] { return this.notif.soundOptions; }
  get soundType(): string { return this.notif.soundType; }
  set soundType(t: string) { this.notif.soundType = t; this.notif.playSound(t); }   // preview as they pick
  previewSound(): void { this.notif.playSound(this.soundType); }

  private activeDriver: any = null;

  ngOnDestroy(): void {
    try { this.activeDriver?.destroy(); } catch { /* ignore */ }
  }

  categoryLoadError = false;

  loadCategories(): void {
    this.categoryLoadError = false;
    this.adminService.getCategories().subscribe({
      next: (cats) => this.categories = cats,
      error: () => {
        this.categoryLoadError = true;
        this.toastr.error('Could not load categories — make sure the backend is running');
      }
    });
  }

  addCategory(): void {
    if (!this.newCategoryName.trim()) return;
    this.savingCategory = true;
    this.adminService.createCategory(this.newCategoryName.trim()).subscribe({
      next: (cat) => {
        this.categories.push(cat);
        this.newCategoryName = '';
        this.savingCategory = false;
        this.toastr.success('Category added');
      },
      error: (err) => {
        this.savingCategory = false;
        this.toastr.error(err.error || 'Failed to add category');
      }
    });
  }

  removeCategory(id: string): void {
    this.confirm.ask({
      title: 'Remove category?',
      message: 'Items in this category will no longer be grouped under it.',
      confirmLabel: 'Remove',
    }).subscribe(ok => {
      if (!ok) return;
      this.performRemoveCategory(id);
    });
  }

  private performRemoveCategory(id: string): void {
    this.removingCategoryId = id;
    this.adminService.deleteCategory(id).subscribe({
      next: () => {
        this.categories = this.categories.filter(c => c.id !== id);
        this.removingCategoryId = null;
        this.toastr.success('Category removed');
      },
      error: () => {
        this.removingCategoryId = null;
        this.toastr.error('Failed to remove category');
      }
    });
  }

  loadStoreHours(): void {
    this.hoursLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/admin/store-hours`, { headers: this.getHeaders() }).subscribe({
      next: (data) => { this.storeHours = data; this.hoursLoading = false; },
      error: () => { this.hoursLoading = false; }
    });
  }

  saveStoreHours(): void {
    // open later than close is a valid overnight window (e.g. 08:00 → 03:00).
    // Only equal open/close is invalid (zero-length / ambiguous).
    const invalid = this.storeHours.find(h => !h.closed && h.openTime && h.closeTime && h.openTime === h.closeTime);
    if (invalid) {
      this.toastr.error(`${this.DAY_NAMES[invalid.dayOfWeek - 1]}: opening and closing time can't be the same`);
      return;
    }
    this.hoursSaving = true;
    this.http.put<any[]>(`${environment.apiUrl}/api/admin/store-hours`, this.storeHours, { headers: this.getHeaders() }).subscribe({
      next: (saved) => {
        this.storeHours = saved;
        this.hoursSaving = false;
        this.toastr.success('Store hours saved');
      },
      error: () => {
        this.hoursSaving = false;
        this.toastr.error('Failed to save store hours');
      }
    });
  }

  onAddressInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.addressDebounce);
    this.settings.latitude = null;
    this.settings.longitude = null;
    if (value.length < 3) { this.addressSuggestions = []; this.showAddressSuggestions = false; return; }
    this.addressLoading = true;
    this.addressDebounce = setTimeout(() => {
      this.geocodingService.autocomplete(value).subscribe({
        next: (suggestions) => {
          this.addressSuggestions = suggestions;
          this.showAddressSuggestions = suggestions.length > 0;
          this.addressLoading = false;
        },
        error: () => { this.addressLoading = false; }
      });
    }, 300);
  }

  onAddressBlur(): void {
    setTimeout(() => { this.showAddressSuggestions = false; }, 200);
  }

  selectAddressSuggestion(s: AddressSuggestion): void {
    this.settings.address = s.label;
    this.settings.latitude = s.lat;
    this.settings.longitude = s.lon;
    this.addressSuggestions = [];
    this.showAddressSuggestions = false;
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.toastr.error('Geolocation is not supported by your browser');
      return;
    }
    this.locating = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        this.geocodingService.reverseGeocode(lat, lon).subscribe({
          next: (res) => {
            this.settings.address = res?.display_name || `${lat}, ${lon}`;
            this.settings.latitude = lat;
            this.settings.longitude = lon;
            this.locating = false;
            this.toastr.success('Location detected');
          },
          error: () => {
            this.settings.latitude = lat;
            this.settings.longitude = lon;
            this.locating = false;
            this.toastr.info('Coordinates set — enter address text manually');
          }
        });
      },
      () => {
        this.locating = false;
        this.toastr.error('Could not get your location — check browser permissions');
      }
    );
  }

  editSettings(): void {
    this.settingsEditing = true;
  }

  cancelSettings(): void {
    this.settingsEditing = false;
    this.settingsSubmitted = false;
    this.loadSettings();  // discard unsaved edits
  }

  saveSettings(): void {
    this.settingsSubmitted = true;
    const s = this.settings;
    if (!s.name?.trim() || !s.phone?.trim() || !s.email?.trim() || !this.settingsEmailValid) return;
    this.isSaving = true;
    // Open/closed is managed from the Dashboard + schedule — don't let a Settings
    // save overwrite the live value with a stale one.
    const payload: any = { ...this.settings };
    delete payload.isOpen;
    this.http.put<TenantSettings>(`${environment.apiUrl}/api/admin/settings`, payload, {
      headers: this.getHeaders()
    }).subscribe({
      next: (updated) => {
        this.settings = updated;
        localStorage.setItem('storeName', updated.name);
        this.tenantService.setCurrentTenant(updated as any);
        if (updated.primaryColor) {
          document.documentElement.style.setProperty('--brand-primary', updated.primaryColor);
          document.documentElement.style.setProperty('--brand-primary-light', updated.primaryColor + '1A');
        }
        // Save hours in the same action so the user doesn't need a separate click
        if (this.storeHours.length > 0) {
          this.http.put<any[]>(`${environment.apiUrl}/api/admin/store-hours`, this.storeHours, { headers: this.getHeaders() }).subscribe({
            next: saved => this.storeHours = saved,
            error: () => this.toastr.error('Settings saved but hours failed — try "Save Hours" above')
          });
        }
        this.toastr.success('Settings saved successfully');
        this.isSaving = false;
        this.settingsEditing = false;
      },
      error: () => {
        this.toastr.error('Failed to save settings');
        this.isSaving = false;
      }
    });
  }

  loadNotifPrefs(): void {
    this.notifPrefsLoading = true;
    this.http.get<any>(`${environment.apiUrl}/api/admin/notification-preferences`, { headers: this.getHeaders() })
      .subscribe({
        next: p => { this.notifPrefs = { emailOnNewOrder: p.emailOnNewOrder, emailOnCancellation: p.emailOnCancellation, emailOnDriverAssigned: p.emailOnDriverAssigned, toastOnNewOrder: p.toastOnNewOrder, toastOnStatusChange: p.toastOnStatusChange }; this.notifPrefsLoading = false; },
        error: () => this.notifPrefsLoading = false
      });
  }

  editNotifPrefs(): void {
    this.notifEditing = true;
  }

  cancelNotifPrefs(): void {
    this.notifEditing = false;
    this.loadNotifPrefs();  // discard unsaved toggles
  }

  saveNotifPrefs(): void {
    this.notifPrefsSaving = true;
    this.http.put<any>(`${environment.apiUrl}/api/admin/notification-preferences`, this.notifPrefs, { headers: this.getHeaders() })
      .subscribe({
        next: () => { this.notifPrefsSaving = false; this.notifEditing = false; this.toastr.success('Notification preferences saved'); },
        error: () => { this.notifPrefsSaving = false; this.toastr.error('Failed to save preferences'); }
      });
  }
}
