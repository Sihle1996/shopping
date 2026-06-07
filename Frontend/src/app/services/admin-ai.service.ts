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

export interface AiPriorObserved {
  avgNetPercent: number;
  samples: number;
  basis: string; // always 'OBSERVATIONAL' — never causal
  note: string;
}

export interface AiPromoAnalysis {
  hypothesis: string;
  evidence: string[];
  insightStrength?: string;        // STRONG | MODERATE | WEAK — the decision gradient
  recommendationType: string;      // 'EXPERIMENT' — the SEMANTIC confidence, not a label
  priorObserved?: AiPriorObserved; // learning data — structurally non-causal
  uncertainty?: string;            // legacy; the uncertainty note now lives in one global banner
}

export interface AiPromoSuggestion {
  facts?: string[];               // observed metrics (data layer)
  analysis?: AiPromoAnalysis;     // structured tokens (epistemic layer), not prose
  reason?: string;                // legacy free-text fallback
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
  calibrated?: boolean;        // figure adjusted by past outcomes of this alert type
  calibrationFactor?: number;  // the applied scale (e.g. 0.8 = forecasts ran high before)
  calibrationSamples?: number; // how much evidence backs the adjustment
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

  /** Draft a short public reply to a single customer review. */
  draftReviewReply(rating: number, comment: string): Observable<{ reply: string }> {
    return this.http.post<{ reply: string }>(`${this.base}/review/draft-reply`, { rating, comment });
  }

  /** Generate descriptions for all menu items missing one (single batched call). */
  bulkDescribe(): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(`${this.base}/menu/bulk-describe`, {});
  }

  /** Plan-fit advice: does the subscription suit current usage & growth? */
  planAdvice(): Observable<{ verdict: string; recommendation: string }> {
    return this.http.get<{ verdict: string; recommendation: string }>(`${this.base}/plan-advice`);
  }

  /** Measured before-vs-during results for each product promotion (the feedback loop). */
  promoOutcomes(): Observable<{ outcomes: any[] }> {
    return this.http.get<{ outcomes: any[] }>(`${this.base}/promo-outcomes`);
  }

  /** Alert calibration: each applied alert fix, predicted impact vs observed sales-rate change. */
  alertOutcomes(): Observable<{ outcomes: any[] }> {
    return this.http.get<{ outcomes: any[] }>(`${this.base}/alert-outcomes`);
  }

  /** The capability manifest (the SAME source the AI reads) — for option-driven UI. */
  capabilities(module?: string): Observable<any[]> {
    const q = module ? `?module=${encodeURIComponent(module)}` : '';
    return this.http.get<any[]>(`${this.base}/capabilities${q}`);
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
