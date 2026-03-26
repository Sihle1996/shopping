import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoaderService } from './loader.service';

// These URL patterns should NOT trigger the global spinner
const SILENT_PATTERNS = [
  '/api/cart/',
  '/api/cart/add',
  '/api/cart/update',
  '/api/cart/delete',
  '/api/admin/settings',
  '/api/admin/menu/upload-image',
  '/api/admin/orders/available-drivers',
  '/api/admin/inventory/adjust',
  '/api/driver/',
  '/api/promotions/',
  '/api/tenants/',
  '/ws',
];

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
  constructor(private loaderService: LoaderService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isSilent = SILENT_PATTERNS.some(pattern => req.url.includes(pattern));

    if (isSilent) {
      return next.handle(req);
    }

    this.loaderService.show();
    return next.handle(req).pipe(finalize(() => this.loaderService.hide()));
  }
}
