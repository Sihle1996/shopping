import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface MenuItem {
  id: string | null;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isAvailable: boolean;
  soldOut?: boolean;        // computed server-side: no free stock after reservations
  stock?: number;
  reservedStock?: number;
  availableStock?: number;  // computed server-side: stock − reserved (sellable)
  lowStockThreshold?: number;
  quantity?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private apiUrl = `${environment.apiUrl}/api/menu`;

  constructor(private http: HttpClient) {}

  getMenuItems(): Observable<MenuItem[]> {
    // Cache-bust so stock/availability tags are always current (no stale 304/disk cache).
    return this.http.get<MenuItem[]>(this.apiUrl, { params: { _: Date.now() } });
  }

  getProductById(productId: string): Observable<MenuItem> {
    return this.http.get<MenuItem>(`${this.apiUrl}/${productId}`);
  }
}
