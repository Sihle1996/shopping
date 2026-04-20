import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';
import { TenantService } from 'src/app/services/tenant.service';
import { CartService } from 'src/app/services/cart.service';
import { LoyaltyService } from 'src/app/services/loyalty.service';
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
  cartCount = 0;
  loyaltyPoints = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private cartService: CartService,
    private loyaltyService: LoyaltyService,
    public router: Router
  ) {}

  ngOnInit() {
    this.refreshAuthState();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects;
      this.isLandingPage = url === '/';

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

    this.tenantService.currentTenant$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tenant => {
        if (tenant) {
          this.storeName = tenant.name;
          this.storeLogo = this.resolveLogoUrl(tenant.logoUrl);
        }
      });

    // Cart count badge
    this.cartService.cartItemCount
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => this.cartCount = count);

    // Loyalty points — load once when logged in
    this.loadLoyalty();
  }

  private loadLoyalty(): void {
    if (!this.authService.isLoggedIn()) return;
    this.loyaltyService.getBalance().pipe(takeUntil(this.destroy$)).subscribe({
      next: b => this.loyaltyPoints = b.balance || 0,
      error: () => {}
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
    const name = localStorage.getItem('storeName');
    if (name) this.storeName = name;
    this.hasStoreContext = !!localStorage.getItem('tenantId');
    this.loadLoyalty();
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
      default:
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
    } else {
      const slug = localStorage.getItem('storeSlug');
      if (slug) {
        if (this.isLoggedIn) {
          // Logged-in customers: logo always goes to store home, never away from the store
          this.router.navigate(['/store', slug]);
        } else {
          // Guests: if already at store root, go back to store list
          const current = this.router.url.split('?')[0].replace(/\/$/, '');
          if (current === `/store/${slug}`) {
            this.router.navigate(['/stores']);
          } else {
            this.router.navigate(['/store', slug]);
          }
        }
      } else {
        this.router.navigate(['/']);
      }
    }
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }

  logout() {
    this.isLoggedIn = false;
    this.userRole = null;
    this.storeName = null;
    this.storeLogo = null;
    this.hasStoreContext = false;
    this.menuOpen = false;
    this.cartCount = 0;
    this.loyaltyPoints = 0;
    this.authService.logout();
  }
}
