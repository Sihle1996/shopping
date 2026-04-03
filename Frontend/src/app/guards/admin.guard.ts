import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SubscriptionService } from '../services/subscription.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
    private subscriptionService: SubscriptionService
  ) {}

  canActivate(): boolean {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    const role = this.authService.getUserRole();
    if (role === 'ROLE_ADMIN') {
      // Only check suspension when not already heading to the subscription page
      const currentUrl = this.router.url;
      if (!currentUrl.includes('/admin/subscription')) {
        this.subscriptionService.load().subscribe({
          next: info => {
            if (info.status === 'SUSPENDED') {
              this.router.navigate(['/admin/subscription']);
            }
          }
        });
      }
      return true;
    } else if (role === 'ROLE_DRIVER') {
      this.router.navigate(['/driver/dashboard']);
    } else if (role === 'ROLE_USER') {
      this.router.navigate(['/']);
    } else {
      this.router.navigate(['/login']);
    }
    return false;
  }
}
