import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface IntentChip {
  key: string;
  label: string;
  emoji: string;
}

export interface ScoredItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  isAvailable: boolean;
  score: number;
  tags: string[];
  breakdown: {
    distance: number;
    priceFit: number;
    timeOfDay: number;
    promotion: number;
    weather: number;
    favourite: number;
  };
}

export interface IntentResult {
  intent: string;
  label: string;
  emoji: string;
  items: ScoredItem[];
}

@Injectable({ providedIn: 'root' })
export class IntelligenceService {
  private readonly base = `${environment.apiUrl}/api/intelligence`;

  constructor(private http: HttpClient) {}

  getIntents(): Observable<IntentChip[]> {
    return this.http.get<IntentChip[]>(`${this.base}/intents`);
  }

  getByIntent(key: string, limit = 20): Observable<IntentResult> {
    return this.http.get<IntentResult>(`${this.base}/by-intent`, {
      params: { intent: key, limit: limit.toString() }
    });
  }

  getRecommendations(limit = 8): Observable<{ items: ScoredItem[] }> {
    return this.http.get<{ items: ScoredItem[] }>(`${this.base}/recommendations`, {
      params: { limit: limit.toString() }
    });
  }

  getCombosForItem(itemId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/combos`, { params: { itemId } });
  }

  getAllCombos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/combos`);
  }
}
