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

  requestUpgrade(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/api/admin/subscription/upgrade-request`, {});
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
