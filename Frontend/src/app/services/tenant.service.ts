import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

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
  deliveryFeeBase: number;
  platformCommissionPercent: number;
  stripeAccountId?: string;
  subscriptionStatus: string;
  subscriptionPlan: string;
  active: boolean;
  isOpen?: boolean;
  minimumOrderAmount?: number | null;
  estimatedDeliveryMinutes?: number;
  openingHours?: string;
  cuisineType?: string;
}

export interface TenantRegistration {
  name: string;
  slug: string;
  email: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private apiUrl = `${environment.apiUrl}/api/tenants`;
  private currentTenant = new BehaviorSubject<Tenant | null>(null);
  currentTenant$ = this.currentTenant.asObservable();

  constructor(private http: HttpClient) {}

  registerTenant(data: TenantRegistration): Observable<Tenant> {
    return this.http.post<Tenant>(`${this.apiUrl}/register`, {
      ...data,
      subscriptionStatus: 'TRIAL',
      subscriptionPlan: 'BASIC',
      deliveryRadiusKm: 10,
      active: true
    });
  }

  getTenantBySlug(slug: string): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.apiUrl}/${slug}`).pipe(
      tap(tenant => this.currentTenant.next(tenant))
    );
  }

  getCurrentTenant(): Tenant | null {
    return this.currentTenant.value;
  }

  setCurrentTenant(tenant: Tenant): void {
    this.currentTenant.next(tenant);
  }

  clearTenant(): void {
    this.currentTenant.next(null);
  }
}
