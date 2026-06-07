import { Injectable } from '@angular/core';
import {
  HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

// Transient "backend not reachable yet" statuses — typically a cold start or a
// restart on the host, where the proxy returns 502/503/504 (or the browser sees
// status 0 because the failed response carries no CORS headers).
const TRANSIENT_STATUSES = [0, 502, 503, 504];
const MAX_RETRIES = 3;

/**
 * Global safety net so failures are never silent. Business/validation errors
 * (4xx) are surfaced in-context by the calling component with a specific
 * message; this interceptor only handles the "something is broken" cases
 * (network/CORS down = status 0, or server 5xx) that components usually swallow,
 * showing one clear, dismissible toast. It always re-throws so component error
 * handlers still run.
 *
 * It also auto-retries transient gateway failures on GET requests with backoff,
 * so a page load that lands during a backend restart/cold start recovers on its
 * own instead of failing until the user hard-refreshes. Only GETs are retried —
 * retrying a POST/PUT could double-submit an order or payment.
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private toastr: ToastrService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      retry({
        count: MAX_RETRIES,
        delay: (err: HttpErrorResponse, attempt: number) => {
          const transient = TRANSIENT_STATUSES.includes(err.status);
          if (req.method !== 'GET' || !transient) {
            return throwError(() => err); // don't retry — propagate immediately
          }
          // Backoff: ~0.8s, 1.6s, 2.4s — gives a waking backend time to answer.
          return timer(attempt * 800);
        },
      }),
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
