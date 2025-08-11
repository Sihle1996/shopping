// src/app/services/admin.service.ts
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface OrderItem { name: string; quantity: number; size: string; }
export interface Order {
  id: number; totalAmount: number; status: string; orderDate: string;
  deliveryAddress: string; userEmail: string; paymentId: string; items: OrderItem[];
}
export interface Page<T> { content: T[]; totalPages: number; }
export interface Driver { id: number; name: string; email?: string; driverStatus?: string; }

@Injectable({ providedIn: 'root' })
export class AdminService {
  private baseUrl = 'http://localhost:8080/api/admin';

  private ordersSubject = new BehaviorSubject<Order[]>([]);
  orders$ = this.ordersSubject.asObservable();

  private menuItemsSubject = new BehaviorSubject<any[]>([]);
  menuItems$ = this.menuItemsSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
  }
  private getAuthOnlyHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/stats`, { headers: this.getAuthHeaders() });
  }

  loadOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.baseUrl}/orders`, { headers: this.getAuthHeaders() })
      .pipe(map(orders => { this.ordersSubject.next(orders); return orders; }));
  }

  getOrders(page: number, size: number, query = ''): Observable<Page<Order>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (query) params = params.set('query', query);
    return this.http.get<Page<Order>>(`${this.baseUrl}/orders/search`, { headers: this.getAuthHeaders(), params });
  }

  // Menu (kept optimistic locally if you use your OptimisticService elsewhere)
  getMenuItems(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/menu`, { headers: this.getAuthHeaders() });
  }

  // Status UPDATE now returns Observable (no internal subscribe)
  updateOrderStatus(orderId: number, status: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/orders/update/${orderId}`, null, {
      headers: this.getAuthHeaders(),
      params: new HttpParams().set('status', status)
    });
  }

  deleteOrder(orderId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/orders/delete/${orderId}`, { headers: this.getAuthHeaders() });
  }

  // Drivers
  getDrivers(): Observable<Driver[]> {
    return this.http.get<Driver[]>(`${this.baseUrl}/drivers`, { headers: this.getAuthHeaders() });
  }
  getAvailableDrivers(): Observable<Driver[]> {
    return this.http.get<Driver[]>(`${this.baseUrl}/orders/available-drivers`, { headers: this.getAuthHeaders() });
  }
  assignDriver(orderId: number, driverId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/orders/${orderId}/assign-driver`, { driverId }, { headers: this.getAuthHeaders() });
  }

  // Upload (auth header only; let browser set multipart boundary)
  uploadImage(formData: FormData): Observable<string> {
    return this.http.post<{ imageUrl: string }>(`${this.baseUrl}/menu/upload-image`, formData, {
      headers: this.getAuthOnlyHeaders()
    }).pipe(map(res => res.imageUrl));
  }

  // Inventory
  adjustInventory(adjustments: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/inventory/adjust`, adjustments, { headers: this.getAuthHeaders() });
  }
  exportInventoryCsv(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/inventory/export`, { headers: this.getAuthHeaders(), responseType: 'blob' });
  }
  getInventoryAuditLogs(): Observable<any> {
    return this.http.get(`${this.baseUrl}/inventory/audit`, { headers: this.getAuthHeaders() });
  }

  getHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`, { headers: this.getAuthHeaders() });
  }
}
