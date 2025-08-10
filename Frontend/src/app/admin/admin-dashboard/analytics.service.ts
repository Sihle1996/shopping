import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private baseUrl = '/api/admin/analytics';

  constructor(private http: HttpClient) {}

  getSalesTrends(startDate: string, endDate: string): Observable<any[]> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http.get<any[]>(`${this.baseUrl}/sales-trends`, { params });
  }

  getTopProducts(startDate: string, endDate: string): Observable<any[]> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http.get<any[]>(`${this.baseUrl}/top-products`, { params });
  }

  getAverageOrderValue(startDate: string, endDate: string): Observable<number> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http.get<number>(`${this.baseUrl}/aov`, { params });
  }

  getOnTimePercentage(startDate: string, endDate: string): Observable<number> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http.get<number>(`${this.baseUrl}/on-time`, { params });
  }

  getCancellationRate(startDate: string, endDate: string): Observable<number> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http.get<number>(`${this.baseUrl}/cancellations`, { params });
  }
}
