import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { Observable, tap } from 'rxjs';
import { PushService } from './push.service';


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'token'; 
  private apiUrlAuth = "http://localhost:8080/api"; 

  constructor(private http: HttpClient, private router: Router, private push: PushService) {}

  
  register(data: { email: string; password: string; confirmPassword: string }): Observable<any> {
    return this.http.post(`${this.apiUrlAuth}/register`, data);
  }

  
  login(credentials: { email: string; password: string }): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.apiUrlAuth}/login`, credentials).pipe(
      tap(response => {
        console.log("Login response:", response); 

        if (response.token) {
          localStorage.setItem(this.tokenKey, response.token);
          this.extractUserIdFromToken(response.token); 
        }
      })
    );
  }

 
  private extractUserIdFromToken(token: string): void {
    try {
      const decodedToken: any = jwtDecode(token);
      if (decodedToken && decodedToken.userId) {
        localStorage.setItem('userId', decodedToken.userId.toString());
        console.log("Extracted userId:", decodedToken.userId);
      } else {
        console.warn("⚠️ Warning: userId not found in token.");
      }
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  }

  
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  
  getUserId(): number | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const decodedToken: any = jwtDecode(token);
      return decodedToken.userId ? Number(decodedToken.userId) : null;
    } catch (error) {
      console.error("Error extracting userId:", error);
      return null;
    }
  }

  
  isLoggedIn(): boolean {
    return !!this.getToken() && !!this.getUserId();
  }

  
  logout(): void {
    // Attempt to unregister FCM token on backend while we still have auth
    this.push.unregister().finally(() => {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem('userId');
      this.router.navigate(['/login']);
    });
  }

  getUserRole(): string | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload: any = jwtDecode(token);
      const normalized = this.resolveRoleFromPayload(payload);
      console.log('AuthService.getUserRole -> payload:', payload, 'normalized:', normalized);
      return normalized;
    } catch (error) {
      console.error('Error decoding role:', error);
      return null;
    }
  }

  private resolveRoleFromPayload(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null;

    // Collect possible role strings from common claim shapes
    const collected: string[] = [];

    // Single string claim
    if (typeof payload.role === 'string') collected.push(payload.role);

    // Array claims (strings or objects)
    if (Array.isArray(payload.roles)) collected.push(...this.normalizeArray(payload.roles));
    if (Array.isArray(payload.authorities)) collected.push(...this.normalizeArray(payload.authorities));
    if (payload.realm_access && Array.isArray(payload.realm_access.roles)) {
      collected.push(...payload.realm_access.roles);
    }

    // Space/comma-delimited scope strings (e.g., "ROLE_ADMIN ROLE_USER" or "admin,user")
    const scopes = payload.scope || payload.scopes || payload.permissions || payload.perms;
    if (typeof scopes === 'string') collected.push(...scopes.split(/[\s,]+/));

    // Some backends embed roles as comma-separated string fields
    if (typeof payload.roles === 'string') collected.push(...payload.roles.split(/[\s,]+/));
    if (typeof payload.authorities === 'string') collected.push(...payload.authorities.split(/[\s,]+/));

    // Normalize all to uppercase
    const upper = collected.map((r) => String(r).toUpperCase());

    // Prefer exact ROLE_* matches (or containing keyword)
    if (upper.some((r) => /(^|_|:)ROLE[_:]?ADMIN$/.test(r) || r.includes('ADMIN'))) return 'ROLE_ADMIN';
    if (upper.some((r) => /(^|_|:)ROLE[_:]?MANAGER$/.test(r) || r.includes('MANAGER'))) return 'ROLE_MANAGER';
    if (upper.some((r) => /(^|_|:)ROLE[_:]?DRIVER$/.test(r) || r.includes('DRIVER'))) return 'ROLE_DRIVER';
    if (upper.some((r) => /(^|_|:)ROLE[_:]?USER$/.test(r) || r.includes('USER'))) return 'ROLE_USER';

    // Fallback: some backends use numeric/enum codes
    // Map known alternatives if needed (extend here as you learn your payload)

    return null;
  }

  private normalizeArray(arr: any[]): string[] {
    const out: string[] = [];
    for (const item of arr) {
      if (typeof item === 'string') {
        out.push(item);
      } else if (item && typeof item === 'object') {
        // common shapes: { authority: 'ROLE_ADMIN' }, { role: 'ADMIN' }, { name: 'ADMIN' }
        const cand = (item.authority ?? item.role ?? item.name ?? item.value);
        if (typeof cand === 'string') out.push(cand);
      }
    }
    return out;
  }
  
  
}
