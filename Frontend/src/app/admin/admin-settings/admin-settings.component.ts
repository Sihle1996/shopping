import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { driver } from 'driver.js';
import { AuthService } from 'src/app/services/auth.service';
import { TenantService } from 'src/app/services/tenant.service';
import { AdminService } from 'src/app/services/admin.service';
import { SubscriptionService } from 'src/app/services/subscription.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  primaryColor: string;
  phone: string;
  email: string;
  address: string;
  deliveryRadiusKm: number;
  deliveryFeeBase: number;
  isOpen: boolean;
  minimumOrderAmount: number | null;
  estimatedDeliveryMinutes: number;
  openingHours: string;
  cuisineType: string;
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
    primaryColor: '#FF6F00',
    phone: '',
    email: '',
    address: '',
    deliveryRadiusKm: 10,
    deliveryFeeBase: 0,
    isOpen: true,
    minimumOrderAmount: null,
    estimatedDeliveryMinutes: 30,
    openingHours: '',
    cuisineType: ''
  };
  isLoading = false;
  isSaving = false;
  isUploadingLogo = false;

  hasCustomBranding = false;
  subscriptionPlan = '';

  categories: any[] = [];
  newCategoryName = '';
  savingCategory = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private tenantService: TenantService,
    private adminService: AdminService,
    private subscriptionService: SubscriptionService,
    private toastr: ToastrService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadCategories();
    this.subscriptionService.load().subscribe(info => {
      this.hasCustomBranding = info.features.hasCustomBranding;
      this.subscriptionPlan = info.plan;
    });
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
    this.adminService.deleteCategory(id).subscribe({
      next: () => {
        this.categories = this.categories.filter(c => c.id !== id);
        this.toastr.success('Category removed');
      },
      error: () => this.toastr.error('Failed to remove category')
    });
  }

  saveSettings(): void {
    this.isSaving = true;
    this.http.put<TenantSettings>(`${environment.apiUrl}/api/admin/settings`, this.settings, {
      headers: this.getHeaders()
    }).subscribe({
      next: (updated) => {
        this.settings = updated;
        localStorage.setItem('storeName', updated.name);
        this.tenantService.setCurrentTenant(updated as any);
        // Apply brand color immediately
        if (updated.primaryColor) {
          document.documentElement.style.setProperty('--brand-primary', updated.primaryColor);
          document.documentElement.style.setProperty('--brand-primary-light', updated.primaryColor + '1A');
        }
        this.toastr.success('Settings saved successfully');
        this.isSaving = false;
      },
      error: () => {
        this.toastr.error('Failed to save settings');
        this.isSaving = false;
      }
    });
  }
}
