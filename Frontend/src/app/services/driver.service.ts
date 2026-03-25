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

  markAsDelivered(orderId: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/orders/${orderId}/delivered`, {});
  }

  updateAvailability(status: 'AVAILABLE' | 'UNAVAILABLE'): Observable<any> {
    return this.http.put(`${this.baseUrl}/availability?status=${status}`, {});
  }
}
