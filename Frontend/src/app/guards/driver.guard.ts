import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class DriverGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    const role = this.auth.getUserRole();
    if (role === 'ROLE_DRIVER') {
      return true;
    } else if (role === 'ROLE_ADMIN') {
      this.router.navigate(['/admin/dashboard']);
    } else if (role === 'ROLE_MANAGER') {
      this.router.navigate(['/manager/dashboard']);
    } else if (role === 'ROLE_USER') {
      this.router.navigate(['/']);
    } else {
      this.router.navigate(['/login']);
    }
    return false;
  }
}
