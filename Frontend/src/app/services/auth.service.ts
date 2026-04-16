import { HttpClient } from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AdminService } from './admin.service';
import { SubscriptionService } from './subscription.service';
import { CartService } from './cart.service';
import { TenantService } from './tenant.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'token';
  private apiUrlAuth = `${environment.apiUrl}/api`;

  constructor(
    private http: HttpClient,
    private router: Router,
    private injector: Injector
  ) {}

  register(data: { email: string; password: string; confirmPassword: string }, tenantId?: string): Observable<any> {
    const url = tenantId
      ? `${this.apiUrlAuth}/register?tenantId=${tenantId}`
      : `${this.apiUrlAuth}/register`;
    return this.http.post(url, data);
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrlAuth}/verify-email`, { params: { token } });
  }

  login(credentials: { email: string; password: string }): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.apiUrlAuth}/login`, credentials).pipe(
      tap(response => { if (response.token) this.storeToken(response.token); })
    );
  }

  storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
    this.extractClaimsFromToken(token);
  }

  private extractClaimsFromToken(token: string): void {
    try {
      const decoded: any = jwtDecode(token);
      if (decoded.userId) {
        localStorage.setItem('userId', decoded.userId.toString());
      }
      if (decoded.tenantId) {
        localStorage.setItem('tenantId', decoded.tenantId.toString());
      }
    } catch (error) {
      // Token decode failed silently
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUserId(): string | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const decoded: any = jwtDecode(token);
      return decoded.userId || null;
    } catch {
      return null;
    }
  }

  getTenantId(): string | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const decoded: any = jwtDecode(token);
      return decoded.tenantId || null;
    } catch {
      return null;
    }
  }

  isTokenExpired(token: string): boolean {
    try {
      const decoded: any = jwtDecode(token);
      if (!decoded.exp) return false;
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    if (this.isTokenExpired(token)) {
      localStorage.removeItem(this.tokenKey);
      return false;
    }
    return !!this.getUserId();
  }

  checkSessionOnStartup(): void {
    const token = this.getToken();
    if (token && this.isTokenExpired(token)) {
      this.logout();
    }
  }

  logout(): void {
    ['token', 'userId', 'tenantId', 'storeName', 'storeSlug', 'brandPrimary',
     'customer_lat', 'customer_lon', 'customer_address'].forEach(k => localStorage.removeItem(k));
    this.injector.get(AdminService).reset();
    this.injector.get(SubscriptionService).reset();
    this.injector.get(CartService).reset();
    this.injector.get(TenantService).clearTenant();
    // Reset brand color to platform default
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', '#FF6F00');
    root.style.setProperty('--brand-primary-light', '#FF6F001A');
    root.style.setProperty('--brand-primary-hover', '#EA580C');
    this.router.navigate(['/login']);
  }

  getUserRole(): string | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload: any = jwtDecode(token);
      return this.resolveRoleFromPayload(payload);
    } catch {
      return null;
    }
  }

  private resolveRoleFromPayload(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null;

    const collected: string[] = [];

    if (typeof payload.role === 'string') collected.push(payload.role);
    if (Array.isArray(payload.roles)) collected.push(...this.normalizeArray(payload.roles));
    if (Array.isArray(payload.authorities)) collected.push(...this.normalizeArray(payload.authorities));

    const upper = collected.map((r) => String(r).toUpperCase());

    if (upper.some((r) => r.includes('SUPERADMIN'))) return 'ROLE_SUPERADMIN';
    if (upper.some((r) => r.includes('ADMIN'))) return 'ROLE_ADMIN';
    if (upper.some((r) => r.includes('DRIVER'))) return 'ROLE_DRIVER';
    if (upper.some((r) => r.includes('USER'))) return 'ROLE_USER';

    return null;
  }

  private normalizeArray(arr: any[]): string[] {
    const out: string[] = [];
    for (const item of arr) {
      if (typeof item === 'string') {
        out.push(item);
      } else if (item && typeof item === 'object') {
        const cand = (item.authority ?? item.role ?? item.name ?? item.value);
        if (typeof cand === 'string') out.push(cand);
      }
    }
    return out;
  }
}
