import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private baseUrl = 'http://localhost:8080/api/admin';

  constructor(private http: HttpClient) {}

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

  // ✅ Get all admin orders
  getAllOrders(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders`, {
      headers: this.getAuthHeaders()
    });
  }

  // ✅ Get all menu items
  getMenuItems(): Observable<any> {
    return this.http.get(`${this.baseUrl}/menu`, {
      headers: this.getAuthHeaders()
    });
  }

  // ✅ Add menu item
  createMenuItem(item: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/menu`, item, {
      headers: this.getAuthHeaders()
    });
  }

  // ✅ Update menu item
  updateMenuItem(id: number, item: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/menu/${id}`, item, {
      headers: this.getAuthHeaders()
    });
  }

  // ✅ Delete menu item
  deleteMenuItem(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/menu/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  // ✅ Update order status
  updateOrderStatus(orderId: number, status: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/orders/update/${orderId}?status=${status}`, null, {
      headers: this.getAuthHeaders()
    });
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
    
}
