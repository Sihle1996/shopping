import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';
import { TenantService } from 'src/app/services/tenant.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  menuOpen = false;
  isLoggedIn = false;
  userRole: string | null = null;
  storeName: string | null = null;
  storeLogo: string | null = null;
  homeRoute = '/';

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private router: Router
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.userRole = this.authService.getUserRole();
    this.homeRoute = this.getHomeRoute();

    // Reactive — updates navbar immediately when tenant changes
    this.tenantService.currentTenant$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tenant => {
        if (tenant) {
          this.storeName = tenant.name;
          this.storeLogo = this.resolveLogoUrl(tenant.logoUrl);
        }
      });

    // Fallback from localStorage
    const name = localStorage.getItem('storeName');
    if (name && !this.storeName) this.storeName = name;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getHomeRoute(): string {
    switch (this.userRole) {
      case 'ROLE_ADMIN': return '/admin/dashboard';
      case 'ROLE_DRIVER': return '/driver/dashboard';
      case 'ROLE_MANAGER': return '/manager/dashboard';
      default: return '/';
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  private resolveLogoUrl(url?: string): string | null {
    if (!url) return null;
    return url.startsWith('http') ? url : `${environment.apiUrl}${url}`;
  }

  logout() {
    this.authService.logout();
    localStorage.removeItem('storeName');
    this.tenantService.clearTenant();
    this.isLoggedIn = false;
    this.storeName = null;
    this.storeLogo = null;
    this.menuOpen = false;
    this.router.navigate(['/login']);
  }
}
