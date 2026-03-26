import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { TenantService } from 'src/app/services/tenant.service';
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
}

@Component({
  selector: 'app-admin-settings',
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.scss']
})
export class AdminSettingsComponent implements OnInit {
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
    deliveryFeeBase: 0
  };
  isLoading = false;
  isSaving = false;
  isUploadingLogo = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private tenantService: TenantService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
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
