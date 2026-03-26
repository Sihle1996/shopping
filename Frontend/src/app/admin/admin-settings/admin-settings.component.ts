import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
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

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
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

  saveSettings(): void {
    this.isSaving = true;
    this.http.put(`${environment.apiUrl}/api/admin/settings`, this.settings, {
      headers: this.getHeaders()
    }).subscribe({
      next: () => {
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
