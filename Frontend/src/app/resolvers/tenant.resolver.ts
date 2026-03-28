import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { TenantService, Tenant } from 'src/app/services/tenant.service';

@Injectable({ providedIn: 'root' })
export class TenantResolver implements Resolve<Tenant | null> {
  constructor(private tenantService: TenantService) {}

  resolve(route: ActivatedRouteSnapshot): Observable<Tenant | null> {
    const slug = route.paramMap.get('slug');
    if (!slug) return of(null);

    return this.tenantService.getTenantBySlug(slug).pipe(
      tap(tenant => {
        localStorage.setItem('tenantId', tenant.id);
        localStorage.setItem('storeName', tenant.name);
        localStorage.setItem('storeSlug', tenant.slug);
        this.tenantService.setCurrentTenant(tenant);
      }),
      catchError(() => of(null))
    );
  }
}
