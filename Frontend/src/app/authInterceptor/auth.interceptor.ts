import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor() {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');

    // Only attach our auth headers to requests bound for our OWN backend — never leak the JWT or
    // tenant id to third-party services (Mapbox, Nominatim, etc.).
    const isAbsolute = /^https?:\/\//i.test(request.url);
    const isInternal = !isAbsolute || request.url.startsWith(environment.apiUrl);
    if (!isInternal) return next.handle(request);

    const isSuperadmin = request.url.includes('/api/superadmin');

    let headers: { [key: string]: string } = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (tenantId && !isSuperadmin) {
      headers['X-Tenant-Id'] = tenantId;
    }

    if (Object.keys(headers).length > 0) {
      const cloned = request.clone({ setHeaders: headers });
      return next.handle(cloned);
    }

    return next.handle(request);
  }
}
