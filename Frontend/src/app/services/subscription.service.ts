import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SubscriptionUsage {
  menuItems: number;
  maxMenuItems: number;
  drivers: number;
  maxDrivers: number;
  activePromotions: number;
  maxPromotions: number;
}

export interface SubscriptionFeatures {
  hasAnalytics: boolean;
  hasCustomBranding: boolean;
  hasInventoryExport: boolean;
  maxDeliveryRadiusKm: number;
  commissionPercent: number;
}

export interface SubscriptionInfo {
  plan: string;
  status: string;
  trialDaysRemaining: number | null;
  usage: SubscriptionUsage;
  features: SubscriptionFeatures;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private apiUrl = environment.apiUrl;
  private infoSubject = new BehaviorSubject<SubscriptionInfo | null>(null);
  info$ = this.infoSubject.asObservable();

  constructor(private http: HttpClient) {}

  load(): Observable<SubscriptionInfo> {
    return this.http.get<SubscriptionInfo>(`${this.apiUrl}/api/admin/subscription`).pipe(
      tap(info => this.infoSubject.next(info))
    );
  }

  reset(): void {
    this.infoSubject.next(null);
  }

  getPlans(): Observable<{ name: string; priceZar: number; isUpgrade: boolean }[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/admin/subscription/plans`);
  }

  upgradePlan(planName: string, paymentId: string): Observable<{ message: string; plan: string; status: string }> {
    return this.http.post<any>(`${this.apiUrl}/api/admin/subscription/upgrade`, { planName, paymentId });
  }

  canAccess(feature: 'analytics' | 'customBranding' | 'inventoryExport'): boolean {
    const info = this.infoSubject.getValue();
    if (!info) return false;
    switch (feature) {
      case 'analytics': return info.features.hasAnalytics;
      case 'customBranding': return info.features.hasCustomBranding;
      case 'inventoryExport': return info.features.hasInventoryExport;
    }
  }

  isSuspended(): boolean {
    return this.infoSubject.getValue()?.status === 'SUSPENDED';
  }

  get snapshot(): SubscriptionInfo | null {
    return this.infoSubject.getValue();
  }
}
