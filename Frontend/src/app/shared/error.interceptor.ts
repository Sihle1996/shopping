import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

/**
 * Global safety net so failures are never silent. Business/validation errors
 * (4xx) are surfaced in-context by the calling component with a specific
 * message; this interceptor only handles the "something is broken" cases
 * (network/CORS down = status 0, or server 5xx) that components usually swallow,
 * showing one clear, dismissible toast. It always re-throws so component error
 * handlers still run.
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private toastr: ToastrService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        const isNetwork = err.status === 0;
        const isServer = err.status >= 500;
        if (isNetwork || isServer) {
          const msg = isNetwork
            ? "Can't reach the server right now. Check your connection and try again."
            : 'Something went wrong on our end. Please try again in a moment.';
          this.toastr.error(msg, '', { timeOut: 10000, extendedTimeOut: 5000, closeButton: true });
        }
        return throwError(() => err);
      }),
    );
  }
}
