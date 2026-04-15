import { Component, OnDestroy, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnDestroy {
  title = 'App';
  isAdminRoute = false;
  isDriverRoute = false;
  isAuthRoute = false;
  isStoreRoute = false;
  isLandingRoute = false;

  private idleTimer: any;
  private readonly activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
  private boundReset = this.resetIdleTimer.bind(this);

  constructor(
    private router: Router,
    private authService: AuthService,
    private ngZone: NgZone
  ) {
    this.authService.checkSessionOnStartup();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects;
      this.isAdminRoute = url.startsWith('/admin');
      this.isDriverRoute = url.startsWith('/driver');
      this.isAuthRoute = url.startsWith('/login') || url.startsWith('/register');
      this.isStoreRoute = url.startsWith('/store/');
      this.isLandingRoute = url.split('#')[0] === '/';
    });

    // Idle timeout runs outside Angular zone to avoid triggering change detection on every mouse move
    this.ngZone.runOutsideAngular(() => {
      this.activityEvents.forEach(e => window.addEventListener(e, this.boundReset, { passive: true }));
      this.resetIdleTimer();
    });
  }

  private isStaffRole(): boolean {
    const role = this.authService.getUserRole();
    return role === 'ROLE_ADMIN' || role === 'ROLE_SUPERADMIN' || role === 'ROLE_DRIVER';
  }

  private resetIdleTimer(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.authService.isLoggedIn() && this.isStaffRole()) {
        this.ngZone.run(() => this.authService.logout());
      }
    }, IDLE_TIMEOUT_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.idleTimer);
    this.activityEvents.forEach(e => window.removeEventListener(e, this.boundReset));
  }
}
