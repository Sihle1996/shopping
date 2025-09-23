import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';

export interface Promotion {
  id: number;
  title: string;
  description?: string;
  imageUrl?: string;
  badgeText?: string;
  discountPercent?: number; // 0-100
  startAt: string;          // ISO string
  endAt: string;            // ISO string
  appliesTo: 'ALL' | 'CATEGORY' | 'PRODUCT';
  targetCategoryId?: number;
  targetProductId?: number;
  code?: string | null;
  active: boolean;
  featured: boolean;
}

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private baseUrl = 'http://localhost:8080/api/promotions';

  constructor(private http: HttpClient) {}

  getActivePromotions(): Observable<Promotion[]> {
    return this.http.get<Promotion[]>(`${this.baseUrl}/active`).pipe(shareReplay(1));
  }

  getFeaturedPromotion(): Observable<Promotion | null> {
    return this.http.get<Promotion>(`${this.baseUrl}/featured`, { observe: 'response' }).pipe(
      map(resp => (resp.status === 204 ? null : (resp.body as Promotion))),
      shareReplay(1)
    );
  }

  validateCode(code: string) {
    return this.http.post(`${this.baseUrl}/validate-code`, { code });
  }
}
