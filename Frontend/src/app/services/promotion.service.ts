import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface Promotion {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  badgeText?: string;
  discountPercent?: number; // 0-100
  startAt: string;          // ISO string
  endAt: string;            // ISO string
  appliesTo: 'ALL' | 'CATEGORY' | 'PRODUCT';
  targetCategoryId?: string;
  targetProductId?: string;
  code?: string | null;
  active: boolean;
  featured: boolean;
}

export type PromoStatus = 'Scheduled' | 'Active' | 'Expired';

export function getPromoStatus(p: Promotion): PromoStatus {
  const now = Date.now();
  const start = new Date(p.startAt).getTime();
  const end = new Date(p.endAt).getTime();
  if (now < start) return 'Scheduled';
  if (now > end) return 'Expired';
  return 'Active';
}

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private baseUrl = `${environment.apiUrl}/api/promotions`;

  constructor(private http: HttpClient) {}

  getActivePromotions(): Observable<Promotion[]> {
    return this.http.get<Promotion[]>(`${this.baseUrl}/active`);
  }

  getFeaturedPromotion(): Observable<Promotion | null> {
    return this.http.get<Promotion>(`${this.baseUrl}/featured`, { observe: 'response' }).pipe(
      map(resp => (resp.status === 204 ? null : (resp.body as Promotion)))
    );
  }

  validateCode(code: string): Observable<Promotion> {
    return this.http.post<Promotion>(`${this.baseUrl}/validate-code`, { code });
  }
}
