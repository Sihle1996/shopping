import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  // Use full backend URL since Angular dev server doesn't proxy /api requests
  private baseUrl = `${environment.apiUrl}/api/admin/analytics`;

  constructor(private http: HttpClient) {}

  private buildRange(startDate: string, endDate: string): HttpParams {
    const start = `${startDate}T00:00:00Z`;
    const end = `${endDate}T23:59:59Z`;
    return new HttpParams().set('startDate', start).set('endDate', end);
  }

  getSalesTrends(startDate: string, endDate: string): Observable<any[]> {
    const params = this.buildRange(startDate, endDate);
    return this.http.get<any[]>(`${this.baseUrl}/sales-trends`, { params });
  }

  getTopProducts(startDate: string, endDate: string): Observable<any[]> {
    const params = this.buildRange(startDate, endDate);
    return this.http.get<any[]>(`${this.baseUrl}/top-products`, { params });
  }

  getAverageOrderValue(startDate: string, endDate: string): Observable<number> {
    const params = this.buildRange(startDate, endDate);
    return this.http.get<number>(`${this.baseUrl}/aov`, { params });
  }

  getOnTimePercentage(startDate: string, endDate: string): Observable<number> {
    const params = this.buildRange(startDate, endDate);
    return this.http.get<number>(`${this.baseUrl}/on-time`, { params });
  }

  getCancellationRate(startDate: string, endDate: string): Observable<number> {
    const params = this.buildRange(startDate, endDate);
    return this.http.get<number>(`${this.baseUrl}/cancellations`, { params });
  }

  getDeliveryTime(startDate: string, endDate: string): Observable<number> {
    const params = this.buildRange(startDate, endDate);
    return this.http.get<number>(`${this.baseUrl}/delivery-time`, { params });
  }

  getPeakHours(startDate: string, endDate: string): Observable<Array<{ hour: number; orderCount: number }>> {
    const params = this.buildRange(startDate, endDate);
    return this.http.get<Array<{ hour: number; orderCount: number }>>(`${this.baseUrl}/peak-hours`, { params });
  }
}
