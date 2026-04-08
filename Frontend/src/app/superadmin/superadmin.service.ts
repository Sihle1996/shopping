import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthService } from '../services/auth.service';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
  phone?: string;
  email?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  deliveryRadiusKm: number;
  deliveryFeeBase?: number;
  platformCommissionPercent: number;
  stripeAccountId?: string;
  subscriptionStatus: string;
  subscriptionPlan: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecentTenant {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: string;
}

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalOrders: number;
  totalRevenue: number;
  planBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  recentTenants: RecentTenant[];
}

@Injectable({ providedIn: 'root' })
export class SuperadminService {
  private base = `${environment.apiUrl}/api/superadmin`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getStats(): Observable<PlatformStats> {
    return this.http.get<PlatformStats>(`${this.base}/stats`, { headers: this.headers() });
  }

  getTenants(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>(`${this.base}/tenants`, { headers: this.headers() });
  }

  createTenant(tenant: Partial<Tenant>): Observable<Tenant> {
    return this.http.post<Tenant>(`${this.base}/tenants`, tenant, { headers: this.headers() });
  }

  updateTenant(id: string, tenant: Partial<Tenant>): Observable<Tenant> {
    return this.http.put<Tenant>(`${this.base}/tenants/${id}`, tenant, { headers: this.headers() });
  }

  updateSubscription(id: string, plan: string, status: string): Observable<Tenant> {
    return this.http.patch<Tenant>(
      `${this.base}/tenants/${id}/subscription`,
      { subscriptionPlan: plan, subscriptionStatus: status },
      { headers: this.headers() }
    );
  }

  toggleActive(id: string): Observable<Tenant> {
    return this.http.patch<Tenant>(`${this.base}/tenants/${id}/toggle-active`, {}, { headers: this.headers() });
  }

  deleteTenant(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/tenants/${id}`, { headers: this.headers() });
  }
}
