import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor() {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');

    const isExternal = request.url.includes('openrouteservice.org');
    if (isExternal) return next.handle(request);

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
