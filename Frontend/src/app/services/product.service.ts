import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ✅ Define MenuItem inline within the service
export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:8080/api/menu'; // Your backend API

  constructor(private http: HttpClient) {}

  // ✅ Get all menu items
  getMenuItems(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.apiUrl}`);
  }

  // ✅ Get a single product by ID
  getProductById(productId: number): Observable<MenuItem> {
    return this.http.get<MenuItem>(`${this.apiUrl}/${productId}`);
  }
}
