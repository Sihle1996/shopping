// src/app/services/admin.service.ts
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OptimisticService } from './optimistic.service';

/** Shared models (exported so components can import from this file) */
export interface OrderItem { name: string; quantity: number; size: string; }
export interface Order {
  id: number;
  totalAmount: number;
  status: string;
  orderDate: string;
  deliveryAddress: string;
  userEmail: string;
  paymentId: string;
  items: OrderItem[];
}
export interface Page<T> { content: T[]; totalPages: number; }
export interface Driver { id: number; name?: string; email?: string; driverStatus?: string; }

/** Driver LOC payload used by map view */
export interface DriverLocation {
  id: number;
  email: string;
  driverStatus: string;
  latitude: number;
  longitude: number;
  speed: number;
  lastPing: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private baseUrl = 'http://localhost:8080/api/admin';

  private ordersSubject = new BehaviorSubject<Order[]>([]);
  orders$ = this.ordersSubject.asObservable();

  private menuItemsSubject = new BehaviorSubject<any[]>([]);
  menuItems$ = this.menuItemsSubject.asObservable();

  constructor(private http: HttpClient, private optimistic: OptimisticService) {}

  /** Auth headers */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
  }
  private getAuthOnlyHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  /** Dashboard */
  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/stats`, { headers: this.getAuthHeaders() });
  }

  /** Orders (list + paging/search) */
  loadOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.baseUrl}/orders`, { headers: this.getAuthHeaders() })
      .pipe(map(orders => { this.ordersSubject.next(orders); return orders; }));
  }

  getOrders(page: number, size: number, query = ''): Observable<Page<Order>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (query) params = params.set('query', query);
    return this.http.get<Page<Order>>(`${this.baseUrl}/orders/search`, { headers: this.getAuthHeaders(), params });
  }

  /** Menus (with optimistic CRUD) */
  loadMenuItems(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/menu`, { headers: this.getAuthHeaders() })
      .pipe(map(items => { this.menuItemsSubject.next(items); return items; }));
  }

  createMenuItem(item: any): void {
    const current = this.menuItemsSubject.getValue();
    const tempItem = { ...item, id: Date.now() };
    const request$ = this.http.post<any>(`${this.baseUrl}/menu`, item, { headers: this.getAuthHeaders() })
      .pipe(map(res => ({ ...item, ...res })));
    this.optimistic.enqueue(
      () => this.menuItemsSubject.next([...current, tempItem]),
      request$,
      () => this.menuItemsSubject.next(current),
      'Menu item created',
      'Failed to create menu item'
    );
  }

  updateMenuItem(id: number, item: any): void {
    const current = this.menuItemsSubject.getValue();
    const index = current.findIndex((i: any) => i.id === id);
    const previous = { ...current[index] };
    const updated = [...current]; updated[index] = { ...item, id };
    const request$ = this.http.put(`${this.baseUrl}/menu/${id}`, item, { headers: this.getAuthHeaders() });
    this.optimistic.enqueue(
      () => this.menuItemsSubject.next(updated),
      request$,
      () => { const rollback = [...current]; rollback[index] = previous; this.menuItemsSubject.next(rollback); },
      'Menu item updated',
      'Failed to update menu item'
    );
  }

  deleteMenuItem(id: number): void {
    const current = this.menuItemsSubject.getValue();
    const updated = current.filter((i: any) => i.id !== id);
    const request$ = this.http.delete(`${this.baseUrl}/menu/${id}`, { headers: this.getAuthHeaders() });
    this.optimistic.enqueue(
      () => this.menuItemsSubject.next(updated),
      request$,
      () => this.menuItemsSubject.next(current),
      'Menu item deleted',
      'Failed to delete menu item'
    );
  }

  /** Order status: return Observable so component can subscribe (no internal subscribe) */
  updateOrderStatus(orderId: number, status: string): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/orders/update/${orderId}`,
      null,
      { headers: this.getAuthHeaders(), params: new HttpParams().set('status', status) }
    );
  }

  deleteOrder(orderId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/orders/delete/${orderId}`, { headers: this.getAuthHeaders() });
  }

  /** Drivers */
  getDrivers(): Observable<Driver[]> {
    return this.http.get<Driver[]>(`${this.baseUrl}/drivers`, { headers: this.getAuthHeaders() });
  }

  createDriver(dto: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/drivers`, dto, { headers: this.getAuthHeaders() });
  }

  deleteDriver(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/drivers/${id}`, { headers: this.getAuthHeaders() });
  }

  getDriverLocations(): Observable<DriverLocation[]> {
    return this.http.get<DriverLocation[]>(`${this.baseUrl}/drivers/locations`, { headers: this.getAuthHeaders() });
  }

  getAvailableDrivers(): Observable<Driver[]> {
    return this.http.get<Driver[]>(`${this.baseUrl}/orders/available-drivers`, { headers: this.getAuthHeaders() });
  }

  assignDriver(orderId: number, driverId: number): Observable<void> {
  const params = new HttpParams().set('driverId', String(driverId));
  return this.http.post<void>(
    `${this.baseUrl}/orders/${orderId}/assign-driver`,
    null,
    { headers: this.getAuthHeaders(), params }
  );
}


  /** Upload (multipart): don’t set Content-Type manually */
  uploadImage(formData: FormData): Observable<string> {
    return this.http.post<{ imageUrl: string }>(`${this.baseUrl}/menu/upload-image`, formData, {
      headers: this.getAuthOnlyHeaders()
    }).pipe(map(res => res.imageUrl));
  }

  /** Inventory */
  adjustInventory(adjustments: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/inventory/adjust`, adjustments, { headers: this.getAuthHeaders() });
  }
  exportInventoryCsv(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/inventory/export`, { headers: this.getAuthHeaders(), responseType: 'blob' });
  }
  getInventoryAuditLogs(): Observable<any> {
    return this.http.get(`${this.baseUrl}/inventory/audit`, { headers: this.getAuthHeaders() });
  }

  /** Health */
  getHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`, { headers: this.getAuthHeaders() });
  }
}
