import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DriverService {
  private baseUrl = `${environment.apiUrl}/api/driver`;  

  constructor(private http: HttpClient) {}

  getAssignedOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/orders`);
  }

  markAsDelivered(orderId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/orders/${orderId}/delivered`, {});
  }

  requestDeliveryOtp(orderId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${orderId}/request-otp`, {});
  }

  verifyDeliveryOtp(orderId: string, otp: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/${orderId}/verify-otp`, { otp });
  }

  updateAvailability(status: 'AVAILABLE' | 'UNAVAILABLE'): Observable<any> {
    return this.http.put(`${this.baseUrl}/availability?status=${status}`, {});
  }

  getProfile(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/profile`);
  }

  updateProfile(data: { fullName?: string; phone?: string; vehicleType?: string; vehiclePlate?: string }): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/profile`, data);
  }

  getEarnings(): Observable<{ deliveredCount: number; totalEarnings: number }> {
    return this.http.get<any>(`${this.baseUrl}/earnings`);
  }

  getBranding(): Observable<{ primaryColor: string; storeName: string; logoUrl: string }> {
    return this.http.get<any>(`${this.baseUrl}/branding`);
  }
}
