import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DriverService {
  private baseUrl = 'http://localhost:8080/api/driver';  

  constructor(private http: HttpClient) {}

  getAssignedOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/orders`);
  }

  markAsDelivered(orderId: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/orders/${orderId}/delivered`, {});
  }

  updateAvailability(status: 'AVAILABLE' | 'UNAVAILABLE'): Observable<any> {
    return this.http.put(`${this.baseUrl}/availability?status=${status}`, {});
  }
}
