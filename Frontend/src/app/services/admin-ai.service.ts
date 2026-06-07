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
  suggestedPrice?: number;
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

export interface AiProposedAction {
  action: string;
  label: string;
  params: Record<string, any>;
}

export interface AiQueryResponse {
  answer: string;
  data: Record<string, any>;
  question: string;
  proposedActions?: AiProposedAction[];
}

export interface AiActResult {
  ok: boolean;
  message: string;
}

export interface AiBriefing {
  briefing: string;
}

export interface AiSupportDraft {
  category: string;
  urgency: 'low' | 'medium' | 'high' | string;
  draftReply: string;
  suggestedResolution: string;
  suggestedStatus: string;
}

export interface AiAlertImpact {
  revenueAtRisk?: number;
  grossProfitAtRisk?: number;
  netProfitAtRisk?: number;
  timeWindow?: string;
}

export interface AiAlert {
  id: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  body: string;
  createdAt: string;
  action?: AiProposedAction | null;
  impact?: AiAlertImpact | null;
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

  query(question: string, history?: { role: string; text: string }[]): Observable<AiQueryResponse> {
    return this.http.post<AiQueryResponse>(`${this.base}/query`, { question, history: history || [] });
  }

  /** Draft a support-ticket reply + triage (category, urgency, suggested resolution & status). */
  draftSupport(subject: string, message: string): Observable<AiSupportDraft> {
    return this.http.post<AiSupportDraft>(`${this.base}/support/draft`, { subject, message });
  }

  /** Apply an action the copilot proposed, after the admin confirms. */
  act(action: string, params: Record<string, any>): Observable<AiActResult> {
    return this.http.post<AiActResult>(`${this.base}/act`, { action, params });
  }

  /** Proactive daily briefing (pure advice — operational items live in alerts). */
  briefing(): Observable<AiBriefing> {
    return this.http.get<AiBriefing>(`${this.base}/briefing`);
  }

  /** Proactive Smart Alerts for the bell. */
  alerts(): Observable<AiAlert[]> {
    return this.http.get<AiAlert[]>(`${this.base}/alerts`);
  }

  applyAlert(id: string): Observable<AiActResult> {
    return this.http.post<AiActResult>(`${this.base}/alerts/${id}/apply`, {});
  }

  dismissAlert(id: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/alerts/${id}/dismiss`, {});
  }
}
