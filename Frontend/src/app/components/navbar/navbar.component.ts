import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth.service';
import { TenantService } from 'src/app/services/tenant.service';
import { CartService } from 'src/app/services/cart.service';
import { environment } from 'src/environments/environment';
import { cloudinaryUrl } from 'src/app/shared/utils/cloudinary.util';
import { resetStoreBranding } from 'src/app/shared/utils/brand-theme.util';

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
  inStore = false;

  private destroy$ = new Subject<void>();

  constructor(
    public authService: AuthService,
    private tenantService: TenantService,
    private cartService: CartService,
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
      // "In a store" = a specific /store/<slug> route (the /stores list does NOT count).
      this.inStore = url.split('?')[0].startsWith('/store/');

      if (this.isLandingPage && !this.authService.getTenantId()) {
        ['tenantId', 'storeName', 'storeSlug', 'brandPrimary'].forEach(k => localStorage.removeItem(k));
        this.tenantService.clearTenant();
      }

      this.refreshAuthState();

      // Once a customer is no longer viewing a store, drop the store's theme + logo and show CraveIt
      // branding. (localStorage store context is intentionally kept so they can navigate back.)
      if (!this.inStore && this.isCustomer) {
        this.storeName = null;
        this.storeLogo = null;
        this.resetBrandColors();
      }
    });

    this.tenantService.currentTenant$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tenant => {
        this.storeName = tenant ? tenant.name : null;
        this.storeLogo = tenant ? this.resolveLogoUrl(tenant.logoUrl) : null;
      });

    // Cart count badge
    this.cartService.cartItemCount
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => this.cartCount = count);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private refreshAuthState(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.userRole = this.authService.getUserRole();
    this.homeRoute = this.getHomeRoute();
    // Only surface the store name in the nav while actually viewing that store.
    if (this.inStore) {
      const name = localStorage.getItem('storeName');
      if (name) this.storeName = name;
    }
    this.hasStoreContext = !!localStorage.getItem('tenantId');
  }

  /** Revert the CSS theme (colour, accent, font, button) to CraveIt defaults when a customer
   *  leaves a store — otherwise a store's font/accent would leak into the CraveIt store list. */
  private resetBrandColors(): void {
    resetStoreBranding();
  }

  get cartRoute(): string {
    const slug = localStorage.getItem('storeSlug');
    return slug ? `/store/${slug}/cart` : '/cart';
  }

  get ordersRoute(): string {
    const slug = localStorage.getItem('storeSlug');
    return slug ? `/store/${slug}/orders` : '/orders';
  }

  get favouritesRoute(): string {
    const slug = localStorage.getItem('storeSlug');
    return slug ? `/store/${slug}/favourites` : '/';
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
        return this.authService.isLoggedIn() ? '/stores' : '/';
    }
  }

  private resolveLogoUrl(url?: string): string | null {
    if (!url) return null;
    const full = url.startsWith('http') ? url : `${environment.apiUrl}${url}`;
    return cloudinaryUrl(full, 96);
  }

  goHome(): void {
    if (this.userRole === 'ROLE_ADMIN') {
      this.router.navigate(['/admin/dashboard']);
    } else if (this.userRole === 'ROLE_DRIVER') {
      this.router.navigate(['/driver/dashboard']);
    } else {
      const current = this.router.url.split('?')[0].replace(/\/$/, '');
      // From the store list, the brand logo returns to the landing page.
      if (current === '/stores') {
        this.router.navigate(['/']);
        return;
      }
      const slug = localStorage.getItem('storeSlug');
      if (slug) {
        if (this.authService.isLoggedIn()) {
          this.router.navigate(['/store', slug]);
        } else {
          this.router.navigate(current === `/store/${slug}` ? ['/stores'] : ['/store', slug]);
        }
      } else {
        this.router.navigate(this.authService.isLoggedIn() ? ['/stores'] : ['/']);
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
    this.authService.logout();
  }
}
