import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OptimisticService } from './optimistic.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private baseUrl = 'http://localhost:8080/api/admin';

  private ordersSubject = new BehaviorSubject<any[]>([]);
  orders$ = this.ordersSubject.asObservable();

  private menuItemsSubject = new BehaviorSubject<any[]>([]);
  menuItems$ = this.menuItemsSubject.asObservable();

  constructor(private http: HttpClient, private optimistic: OptimisticService) {}

  // ✅ Helper to attach token
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token'); // Make sure token is stored here
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    });
  }

  // ✅ Get Admin Dashboard Stats
  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/stats`, {
      headers: this.getAuthHeaders()
    });
  }

  // ✅ Initial load of orders into local state
  loadOrders(): Observable<any[]> {
    return this.http
      .get<any[]>(`${this.baseUrl}/orders`, { headers: this.getAuthHeaders() })
      .pipe(
        map(orders => {
          this.ordersSubject.next(orders);
          return orders;
        })
      );
  }

  // ✅ Initial load of menu items into local state
  loadMenuItems(): Observable<any[]> {
    return this.http
      .get<any[]>(`${this.baseUrl}/menu`, { headers: this.getAuthHeaders() })
      .pipe(
        map(items => {
          this.menuItemsSubject.next(items);
          return items;
        })
      );
  // ✅ Get paginated & searchable orders
  getOrders(page: number, size: number, query: string): Observable<any> {
    const params: any = { page, size };
    if (query) {
      params.query = query;
    }
    return this.http.get(`${this.baseUrl}/orders/search`, {
      headers: this.getAuthHeaders(),
      params
    });
  }

  // ✅ Get all menu items
  getMenuItems(): Observable<any> {
    return this.http.get(`${this.baseUrl}/menu`, {
      headers: this.getAuthHeaders()
    });
  }

  // ✅ Add menu item (optimistic)
  createMenuItem(item: any): void {
    const current = this.menuItemsSubject.getValue();
    const tempItem = { ...item, id: Date.now() };

    const request$ = this.http.post<any>(`${this.baseUrl}/menu`, item, {
      headers: this.getAuthHeaders()
    }).pipe(map(res => ({ ...item, ...res })));

    this.optimistic.enqueue(
      () => this.menuItemsSubject.next([...current, tempItem]),
      request$,
      () => this.menuItemsSubject.next(current),
      'Menu item created',
      'Failed to create menu item'
    );
  }

  // ✅ Update menu item (optimistic)
  updateMenuItem(id: number, item: any): void {
    const current = this.menuItemsSubject.getValue();
    const index = current.findIndex((i: any) => i.id === id);
    const previous = { ...current[index] };
    const updated = [...current];
    updated[index] = { ...item, id };

    const request$ = this.http.put(`${this.baseUrl}/menu/${id}`, item, {
      headers: this.getAuthHeaders()
    });

    this.optimistic.enqueue(
      () => this.menuItemsSubject.next(updated),
      request$,
      () => {
        const rollback = [...current];
        rollback[index] = previous;
        this.menuItemsSubject.next(rollback);
      },
      'Menu item updated',
      'Failed to update menu item'
    );
  }

  // ✅ Delete menu item (optimistic)
  deleteMenuItem(id: number): void {
    const current = this.menuItemsSubject.getValue();
    const updated = current.filter((i: any) => i.id !== id);

    const request$ = this.http.delete(`${this.baseUrl}/menu/${id}`, {
      headers: this.getAuthHeaders()
    });

    this.optimistic.enqueue(
      () => this.menuItemsSubject.next(updated),
      request$,
      () => this.menuItemsSubject.next(current),
      'Menu item deleted',
      'Failed to delete menu item'
    );
  }

  // ✅ Update order status (optimistic)
  updateOrderStatus(orderId: number, status: string): void {
    const current = this.ordersSubject.getValue();
    const updated = current.map(o => (o.id === orderId ? { ...o, status } : o));
    const request$ = this.http.put(
      `${this.baseUrl}/orders/update/${orderId}?status=${status}`,
      null,
      { headers: this.getAuthHeaders() }
    );

    this.optimistic.enqueue(
      () => this.ordersSubject.next(updated),
      request$,
      () => this.ordersSubject.next(current),
      'Order status updated',
      'Failed to update order status'
    );
  }

  // ✅ Delete order
  deleteOrder(orderId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/orders/delete/${orderId}`, {
      headers: this.getAuthHeaders()
    });
  }

  // ✅ Driver Management
  getDrivers(): Observable<any> {
    return this.http.get(`${this.baseUrl}/drivers`, {
      headers: this.getAuthHeaders()
    });
  }

  createDriver(dto: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/drivers`, dto, {
      headers: this.getAuthHeaders()
    });
  }

  deleteDriver(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/drivers/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

   // admin.service.ts
  assignDriver(orderId: number, driverId: number): Observable<any> {
  return this.http.post(
    `${this.baseUrl}/orders/${orderId}/assign-driver?driverId=${driverId}`,
    null,
    { headers: this.getAuthHeaders() }
  );
  }

  getAvailableDrivers(): Observable<any[]> {
  return this.http.get<any[]>(`${this.baseUrl}/orders/available-drivers`, {
    headers: this.getAuthHeaders()
  });
  }
  
  uploadImage(formData: FormData): Observable<string> {
    return this.http.post<{ imageUrl: string }>('http://localhost:8080/api/admin/menu/upload-image', formData).pipe(
      map((res: { imageUrl: string }) => res.imageUrl) // ✅ FIX: Add proper type to res
    );
  }

  getHealth(): Observable<any> {
    return this.http.get(`${this.baseUrl}/health`, {
  // ✅ Inventory Management
  adjustInventory(adjustments: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/inventory/adjust`, adjustments, {
      headers: this.getAuthHeaders()
    });
  }

  exportInventoryCsv(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/inventory/export`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    });
  }

  getInventoryAuditLogs(): Observable<any> {
    return this.http.get(`${this.baseUrl}/inventory/audit`, {
      headers: this.getAuthHeaders()
    });
  }

}
