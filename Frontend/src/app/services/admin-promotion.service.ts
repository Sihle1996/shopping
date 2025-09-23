import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Promotion } from './promotion.service';

export interface PromotionRequest {
  title: string;
  description?: string;
  imageUrl?: string;
  badgeText?: string;
  discountPercent?: number;
  startAt: string; // ISO string
  endAt: string;   // ISO string
  appliesTo: 'ALL' | 'CATEGORY' | 'PRODUCT';
  targetCategoryId?: number | null;
  targetProductId?: number | null;
  code?: string | null;
  active: boolean;
  featured: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminPromotionService {
  private baseUrl = 'http://localhost:8080/api/admin/promotions';

  constructor(private http: HttpClient) {}

  list(): Observable<Promotion[]> {
    return this.http.get<Promotion[]>(this.baseUrl);
  }

  create(req: PromotionRequest): Observable<Promotion> {
    return this.http.post<Promotion>(this.baseUrl, req);
  }

  update(id: number, req: PromotionRequest): Observable<Promotion> {
    return this.http.put<Promotion>(`${this.baseUrl}/${id}`, req);
  }

  delete(id: number) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  setActive(id: number, value: boolean): Observable<Promotion> {
    return this.http.patch<Promotion>(`${this.baseUrl}/${id}/activate`, null, { params: { value } as any });
  }

  setFeatured(id: number, value: boolean): Observable<Promotion> {
    return this.http.patch<Promotion>(`${this.baseUrl}/${id}/featured`, null, { params: { value } as any });
  }
}
