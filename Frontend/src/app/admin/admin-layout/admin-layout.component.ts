import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { TenantService } from 'src/app/services/tenant.service';
import { AdminThemeService } from 'src/app/services/theme.service';
import { applyBrandFontOnly } from 'src/app/shared/utils/brand-theme.util';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit, OnDestroy {

  // Phosphor icon names (weight — regular vs fill — is applied per active state in the template).
  navGroups = [
    { section: 'Overview', items: [
      { route: '/admin/dashboard', label: 'Dashboard', icon: 'ph-squares-four', exact: true },
      { route: '/admin/activity', label: 'Activity', icon: 'ph-clock-counter-clockwise', exact: false },
    ]},
    { section: 'Operations', items: [
      { route: '/admin/orders', label: 'Orders', icon: 'ph-receipt', exact: false },
      { route: '/admin/menu', label: 'Menu', icon: 'ph-fork-knife', exact: false },
      { route: '/admin/inventory', label: 'Inventory', icon: 'ph-package', exact: false },
      { route: '/admin/drivers', label: 'Drivers', icon: 'ph-moped', exact: false },
    ]},
    { section: 'Growth', items: [
      { route: '/admin/promotions', label: 'Promos', icon: 'ph-tag', exact: false },
      { route: '/admin/customers', label: 'Customers', icon: 'ph-users-three', exact: false },
      { route: '/admin/reviews', label: 'Reviews', icon: 'ph-star', exact: false },
    ]},
    { section: 'Finance', items: [
      { route: '/admin/payouts', label: 'Payouts', icon: 'ph-wallet', exact: false },
      { route: '/admin/books', label: 'Books', icon: 'ph-notebook', exact: false },
      { route: '/admin/subscription', label: 'Plan', icon: 'ph-credit-card', exact: false },
    ]},
    { section: 'Account', items: [
      { route: '/admin/users', label: 'Team', icon: 'ph-users', exact: false },
      { route: '/admin/settings', label: 'Settings', icon: 'ph-gear-six', exact: false },
      { route: '/admin/support', label: 'Support', icon: 'ph-headset', exact: false },
    ]},
  ];

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private tenantService: TenantService,
    public theme: AdminThemeService
  ) {}

  ngOnInit(): void {
    this.theme.init();
    this.loadTenantBranding();
  }

  ngOnDestroy(): void {
    // Drop the body dark flag when leaving the admin shell so the customer storefront stays light.
    this.theme.teardown();
    // Reset the heading font to default so the admin's store font doesn't bleed into the store list
    // (the store page re-applies its own font on a /store/ route).
    document.documentElement.style.setProperty('--brand-font', 'var(--font-heading)');
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
          // Admin adopts ONLY the store's heading font (accent/buttons stay standard in admin).
          applyBrandFontOnly(tenant.brandFont);
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
