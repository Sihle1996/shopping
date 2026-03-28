import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class SuperadminGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    const role = this.auth.getUserRole();
    if (role === 'ROLE_SUPERADMIN') {
      return true;
    }

    this.router.navigate(['/login']);
    return false;
  }
}
