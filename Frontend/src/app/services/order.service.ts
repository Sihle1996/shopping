// src/app/services/order.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface Order {
  id: string;
  totalAmount: number;
  status: string;
  orderDate: string;
  deliveryAddress: string;
  userId: string;
  userEmail: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${environment.apiUrl}/api/orders`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  getUserOrders(): Observable<Order[]> {
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<Order[]>(this.apiUrl, { headers });
  }
}
