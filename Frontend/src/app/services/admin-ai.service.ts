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
}
