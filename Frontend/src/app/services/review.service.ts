import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ReviewSummary {
  reviews: ReviewDTO[];
  averageRating: number;
  totalReviews: number;
}

export interface ReviewDTO {
  id: string;
  rating: number;
  comment: string;
  userName: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  getStoreReviews(): Observable<ReviewSummary> {
    return this.http.get<ReviewSummary>(`${this.api}/api/reviews`);
  }

  submitReview(orderId: string, rating: number, comment: string): Observable<any> {
    return this.http.post(`${this.api}/api/reviews/order/${orderId}`,
      { rating, comment }, { headers: this.headers() });
  }

  // Admin
  adminGetReviews(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/api/admin/reviews`, { headers: this.headers() });
  }

  adminDeleteReview(id: string): Observable<any> {
    return this.http.delete(`${this.api}/api/admin/reviews/${id}`, { headers: this.headers() });
  }
}
