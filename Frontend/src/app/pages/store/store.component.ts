import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantService, Tenant } from 'src/app/services/tenant.service';

@Component({
  selector: 'app-store',
  templateUrl: './store.component.html',
  styleUrls: ['./store.component.scss']
})
export class StoreComponent implements OnInit, OnDestroy {
  tenant: Tenant | null = null;
  isLoading = true;
  notFound = false;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private tenantService: TenantService
  ) {}

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.router.navigate(['/']);
      return;
    }

    this.tenantService.getTenantBySlug(slug).subscribe({
      next: (tenant) => {
        this.tenant = tenant;
        localStorage.setItem('tenantId', tenant.id);
        localStorage.setItem('storeName', tenant.name);
        localStorage.setItem('storeSlug', tenant.slug);
        this.tenantService.setCurrentTenant(tenant);
        this.applyBrandColor(tenant.primaryColor);
        this.isLoading = false;
      },
      error: () => {
        this.notFound = true;
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.resetBrandColor();
  }

  private applyBrandColor(color?: string): void {
    if (!color) return;
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', color);
    root.style.setProperty('--brand-primary-light', color + '1A'); // 10% opacity
    root.style.setProperty('--brand-primary-hover', this.darkenColor(color, 15));
  }

  private resetBrandColor(): void {
    const root = document.documentElement;
    root.style.removeProperty('--brand-primary');
    root.style.removeProperty('--brand-primary-light');
    root.style.removeProperty('--brand-primary-hover');
  }

  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(2.55 * percent));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(2.55 * percent));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }
}
