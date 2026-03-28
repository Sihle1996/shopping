import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
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
  hasStoreContext = false;
  isLandingPage = true;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private router: Router
  ) {}

  ngOnInit() {
    this.refreshAuthState();

    // Re-check auth state on every navigation (handles login/logout transitions)
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects;
      this.isLandingPage = url === '/';

      // Clear store context only when going back to the landing page.
      // Do NOT clear on navigation to /login or /register — the tenant context
      // must survive to the login request so X-Tenant-Id is sent and the backend
      // can enforce per-store login isolation.
      if (this.isLandingPage && !this.authService.getTenantId()) {
        localStorage.removeItem('tenantId');
        localStorage.removeItem('storeName');
        localStorage.removeItem('storeSlug');
        this.storeName = null;
        this.storeLogo = null;
        this.hasStoreContext = false;
        this.tenantService.clearTenant();
      }

      this.refreshAuthState();
    });

    // Reactive tenant updates (e.g. after saving settings)
    this.tenantService.currentTenant$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tenant => {
        if (tenant) {
          this.storeName = tenant.name;
          this.storeLogo = this.resolveLogoUrl(tenant.logoUrl);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private refreshAuthState(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.userRole = this.authService.getUserRole();
    this.homeRoute = this.getHomeRoute();

    // Load store name from localStorage as fallback
    const name = localStorage.getItem('storeName');
    if (name) this.storeName = name;

    // Check if we're in a store context
    this.hasStoreContext = !!localStorage.getItem('tenantId');
  }

  get cartRoute(): string {
    const slug = localStorage.getItem('storeSlug');
    return slug ? `/store/${slug}/cart` : '/cart';
  }

  get ordersRoute(): string {
    const slug = localStorage.getItem('storeSlug');
    return slug ? `/store/${slug}/orders` : '/orders';
  }

  get isCustomer(): boolean {
    return !this.isLoggedIn || this.userRole === 'ROLE_USER';
  }

  get isAdmin(): boolean {
    return this.userRole === 'ROLE_ADMIN';
  }

  private getHomeRoute(): string {
    switch (this.userRole) {
      case 'ROLE_ADMIN': return '/admin/dashboard';
      case 'ROLE_DRIVER': return '/driver/dashboard';
      case 'ROLE_MANAGER': return '/manager/dashboard';
      default:
        // If browsing a store, go back to that store
        const slug = localStorage.getItem('storeSlug');
        if (slug) return `/store/${slug}`;
        return '/';
    }
  }

  private resolveLogoUrl(url?: string): string | null {
    if (!url) return null;
    return url.startsWith('http') ? url : `${environment.apiUrl}${url}`;
  }

  goHome(): void {
    if (this.userRole === 'ROLE_ADMIN') {
      this.router.navigate(['/admin/dashboard']);
    } else if (this.userRole === 'ROLE_DRIVER') {
      this.router.navigate(['/driver/dashboard']);
    } else if (this.userRole === 'ROLE_MANAGER') {
      this.router.navigate(['/manager/dashboard']);
    } else {
      const slug = localStorage.getItem('storeSlug');
      if (slug) {
        this.router.navigate(['/store', slug]);
      } else {
        this.router.navigate(['/']);
      }
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  logout() {
    this.authService.logout();
    localStorage.removeItem('storeName');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('storeSlug');
    this.tenantService.clearTenant();
    this.isLoggedIn = false;
    this.userRole = null;
    this.storeName = null;
    this.storeLogo = null;
    this.hasStoreContext = false;
    this.menuOpen = false;

    // Reset brand color to default
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', '#FF6F00');
    root.style.setProperty('--brand-primary-light', '#FF6F001A');
    root.style.setProperty('--brand-primary-hover', '#EA580C');

    this.router.navigate(['/']);
  }
}
