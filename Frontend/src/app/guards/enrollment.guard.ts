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
    // Let enrollment and pages needed during enrollment setup through
    if (state.url.startsWith('/admin/enrollment')
        || state.url.startsWith('/admin/menu')
        || state.url.startsWith('/admin/settings')) return of(true);
    // SUPERADMIN bypasses enrollment check
    if (this.authService.getUserRole() === 'ROLE_SUPERADMIN') return of(true);

    return this.adminService.getStoreSettings().pipe(
      map(settings => {
        const approved = settings?.approvalStatus === 'APPROVED';
        const active = settings?.active === true;
        if (!approved || !active) {
          this.router.navigate(['/admin/enrollment']);
          return false;
        }
        return true;
      }),
      catchError(() => of(true))
    );
  }
}
