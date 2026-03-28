import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Tenant } from 'src/app/services/tenant.service';

@Component({
  selector: 'app-store',
  templateUrl: './store.component.html',
  styleUrls: ['./store.component.scss']
})
export class StoreComponent implements OnInit {
  tenant: Tenant | null = null;
  isLoading = false;
  notFound = false;

  constructor(private route: ActivatedRoute, public router: Router) {}

  ngOnInit(): void {
    const tenant: Tenant | null = this.route.snapshot.data['tenant'];
    if (!tenant) {
      this.notFound = true;
      return;
    }
    this.tenant = tenant;
    this.applyBrandColor(tenant.primaryColor);
  }

  private applyBrandColor(color?: string): void {
    if (!color) return;
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', color);
    root.style.setProperty('--brand-primary-light', color + '1A');
    root.style.setProperty('--brand-primary-hover', this.darkenColor(color, 15));
    localStorage.setItem('brandPrimary', color);
  }

  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(2.55 * percent));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(2.55 * percent));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }
}
