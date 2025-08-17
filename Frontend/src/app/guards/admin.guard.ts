import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';


@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    const role = this.authService.getUserRole();
    console.log("🛡️ AdminGuard checked role:", role); // should show ROLE_ADMIN
    if (role === 'ROLE_ADMIN') {
      return true;
    } else if (role === 'ROLE_MANAGER') {
      this.router.navigate(['/manager/dashboard']);
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
