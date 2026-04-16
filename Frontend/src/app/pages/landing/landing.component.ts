import { Component, OnInit } from '@angular/core';
import { TenantService } from 'src/app/services/tenant.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html'
})
export class LandingComponent implements OnInit {
  isLoggedIn = false;

  constructor(private tenantService: TenantService, private authService: AuthService) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    // Reset any store branding left over from a previous store visit
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', '#E76F51');
    root.style.setProperty('--brand-primary-light', '#E76F511A');
    root.style.setProperty('--brand-primary-hover', '#C15A35');
    this.tenantService.clearTenant();
    ['tenantId', 'storeName', 'storeSlug', 'brandPrimary'].forEach(k => localStorage.removeItem(k));
  }
}
