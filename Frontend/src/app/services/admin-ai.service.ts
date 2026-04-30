import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface AiDescribeItemRequest {
  name: string;
  price: number;
  category: string;
}

export interface AiDescribeItemResponse {
  description: string;
  tags: string[];
  suggestedCategory: string;
}

export interface AiReviewDigestResponse {
  period: string;
  sentimentScore: number;
  positives: string[];
  negatives: string[];
  recommendation: string;
}

export interface AiProposedPromo {
  title: string;
  discountPercent: number;
  appliesTo: string;
  targetProductName?: string;
  targetProductId?: string;
  startAt: string;
  endAt: string;
}

export interface AiPromoSuggestion {
  reason: string;
  proposedPromo: AiProposedPromo;
}

export interface AiPromoSuggestionsResponse {
  suggestions: AiPromoSuggestion[];
}

export interface AiQueryResponse {
  answer: string;
  data: Record<string, any>;
  question: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAiService {
  private readonly base = `${environment.apiUrl}/api/admin/ai`;

  constructor(private http: HttpClient) {}

  describeItem(req: AiDescribeItemRequest): Observable<AiDescribeItemResponse> {
    return this.http.post<AiDescribeItemResponse>(`${this.base}/describe-item`, req);
  }

  reviewDigest(since?: string): Observable<AiReviewDigestResponse> {
    const body = since ? { since } : {};
    return this.http.post<AiReviewDigestResponse>(`${this.base}/review-digest`, body);
  }

  suggestPromotions(): Observable<AiPromoSuggestionsResponse> {
    return this.http.post<AiPromoSuggestionsResponse>(`${this.base}/suggest-promotions`, {});
  }

  query(question: string): Observable<AiQueryResponse> {
    return this.http.post<AiQueryResponse>(`${this.base}/query`, { question });
  }
}
