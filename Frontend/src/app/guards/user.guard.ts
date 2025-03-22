// guards/user.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    const role = this.authService.getUserRole();
    if (role === 'ROLE_USER') {
      return true;
    } else {
      // Redirect admin to dashboard
      this.router.navigate(['/admin/dashboard']);
      return false;
    }
  }
}
