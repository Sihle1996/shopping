import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guards the customer ordering flow (cart / checkout). Only real customers (ROLE_USER)
 * may place orders. Store accounts (admin/driver) are bounced to their own area so they
 * can't order as a customer — especially not from their own store. Guests are sent to
 * login (the ordering flow requires an account on the client). The backend enforces the
 * same rule; this is the UX layer.
 */
@Injectable({ providedIn: 'root' })
export class CustomerGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const role = this.authService.getUserRole();
    if (role === 'ROLE_USER') {
      return true;
    }
    if (role === 'ROLE_ADMIN') {
      this.router.navigate(['/admin/dashboard']);
      return false;
    }
    if (role === 'ROLE_DRIVER') {
      this.router.navigate(['/driver/dashboard']);
      return false;
    }
    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
