import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AdminService } from '../services/admin.service';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class EnrollmentGuard implements CanActivate {
  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    // Let the enrollment page itself through
    if (state.url.startsWith('/admin/enrollment')) return of(true);
    // SUPERADMIN bypasses enrollment check
    if (this.authService.getUserRole() === 'ROLE_SUPERADMIN') return of(true);

    return this.adminService.getStoreSettings().pipe(
      map(settings => {
        if (settings?.approvalStatus && settings.approvalStatus !== 'APPROVED') {
          this.router.navigate(['/admin/enrollment']);
          return false;
        }
        return true;
      }),
      catchError(() => of(true)) // on error, let through (network issue shouldn't block admin)
    );
  }
}
