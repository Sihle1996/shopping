import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { CartService } from 'src/app/services/cart.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit, OnDestroy {
  cartItemCount = 0;
  activeRoute = '';
  isLoggedIn = false;
  private destroy$ = new Subject<void>();

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.activeRoute = this.router.url;

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((e: any) => {
      this.activeRoute = e.urlAfterRedirects;
      this.isLoggedIn = this.authService.isLoggedIn();
    });

    this.cartService.getCartItemCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => this.cartItemCount = count);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get homeRoute(): string {
    const slug = localStorage.getItem('storeSlug');
    return slug ? `/store/${slug}` : '/';
  }

  get ordersRoute(): string {
    const slug = localStorage.getItem('storeSlug');
    return slug ? `/store/${slug}/orders` : '/orders';
  }

  get cartRoute(): string {
    const slug = localStorage.getItem('storeSlug');
    return slug ? `/store/${slug}/cart` : '/cart';
  }

  isActive(path: string): boolean {
    return this.activeRoute === path || this.activeRoute.startsWith(path + '/');
  }
}
