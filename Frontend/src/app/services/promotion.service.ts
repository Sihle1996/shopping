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
  type?: 'PERCENT_OFF' | 'AMOUNT_OFF' | 'FREE_DELIVERY';
  minSpend?: number | null;
  discountAmount?: number | null;
  startAt: string;          // ISO string
  endAt: string;            // ISO string
  appliesTo: 'ALL' | 'CATEGORY' | 'PRODUCT' | 'MULTI_PRODUCT';
  targetCategoryId?: string;
  targetCategoryName?: string;
  targetProductId?: string;
  targetProductName?: string;
  targetProducts?: { id: string; name: string }[];
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

export interface ThresholdNudge {
  qualified: boolean;   // already over the threshold (reward unlocked)
  rewardLabel: string;  // "free delivery" | "R30 off" | "20% off"
  gap: number;          // rand still to spend (0 when qualified)
}

/** Human reward phrase for a promo, e.g. "free delivery" / "R50 off" / "20% off". */
export function promoRewardLabel(p: Promotion): string {
  if (p.type === 'FREE_DELIVERY') return 'free delivery';
  if (p.type === 'AMOUNT_OFF') return `R${p.discountAmount ?? 0} off`;
  return `${p.discountPercent ?? 0}% off`;
}

/**
 * Nearest auto-applied spend-threshold reward to nudge the customer toward — or, if every
 * threshold is already met, the best reward they've unlocked. Only considers no-code promos
 * (those that apply automatically once the subtotal qualifies). Returns null when there's nothing.
 */
export function thresholdNudge(promos: Promotion[], subtotal: number): ThresholdNudge | null {
  const tiered = (promos || []).filter(p =>
    p.minSpend != null && (p.minSpend as number) > 0 && (p.code == null || p.code.trim() === ''));
  if (!tiered.length) return null;
  const unreached = tiered
    .filter(p => subtotal < (p.minSpend as number))
    .sort((a, b) => (a.minSpend as number) - (b.minSpend as number));
  if (unreached.length) {
    const p = unreached[0];
    return { qualified: false, rewardLabel: promoRewardLabel(p), gap: Math.round(((p.minSpend as number) - subtotal) * 100) / 100 };
  }
  const reached = tiered
    .filter(p => subtotal >= (p.minSpend as number))
    .sort((a, b) => (b.minSpend as number) - (a.minSpend as number));
  return reached.length ? { qualified: true, rewardLabel: promoRewardLabel(reached[0]), gap: 0 } : null;
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
