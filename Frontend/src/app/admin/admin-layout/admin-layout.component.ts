import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { TenantService } from 'src/app/services/tenant.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit {

  navItems = [
    { route: '/admin/dashboard', label: 'Dashboard', icon: 'bi bi-grid', exact: true },
    { route: '/admin/orders', label: 'Orders', icon: 'bi bi-receipt', exact: false },
    { route: '/admin/menu', label: 'Menu', icon: 'bi bi-journal-text', exact: false },
    { route: '/admin/inventory', label: 'Inventory', icon: 'bi bi-box-seam', exact: false },
    { route: '/admin/promotions', label: 'Promos', icon: 'bi bi-tag', exact: false },
    { route: '/admin/drivers', label: 'Drivers', icon: 'bi bi-truck', exact: false },
    { route: '/admin/settings', label: 'Settings', icon: 'bi bi-gear', exact: false },
    { route: '/admin/subscription', label: 'Plan', icon: 'bi bi-credit-card-2-front', exact: false },
    { route: '/admin/users', label: 'Users', icon: 'bi bi-people', exact: false },
    { route: '/admin/reviews', label: 'Reviews', icon: 'bi bi-star', exact: false },
    { route: '/admin/notifications', label: 'Notifications', icon: 'bi bi-bell', exact: false },
  ];

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private tenantService: TenantService
  ) {}

  ngOnInit(): void {
    this.loadTenantBranding();
  }

  private loadTenantBranding(): void {
    const token = this.authService.getToken();
    if (!token) return;

    this.http.get<any>(`${environment.apiUrl}/api/admin/settings`, {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${token}` })
    }).subscribe({
      next: (tenant) => {
        if (tenant) {
          this.tenantService.setCurrentTenant(tenant);
          localStorage.setItem('storeName', tenant.name);
          if (tenant.primaryColor) {
            this.applyBrandColor(tenant.primaryColor);
          }
        }
      }
    });
  }

  private applyBrandColor(color: string): void {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', color);
    root.style.setProperty('--brand-primary-light', color + '1A');
    root.style.setProperty('--brand-primary-hover', this.darkenColor(color, 15));
  }

  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(2.55 * percent));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(2.55 * percent));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }
}
