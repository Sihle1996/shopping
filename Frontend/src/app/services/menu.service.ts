import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ✅ Updated MenuItem interface to match backend response
export interface MenuItem {
  id: number | null;
  name: string;
  description: string;
  price: number;
  image: string; 
  category: string;
  isAvailable: boolean;
  quantity?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private apiUrl = 'http://localhost:8080/api/menu';

  constructor(private http: HttpClient) {}

  getMenuItems(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(this.apiUrl);
  }

  getProductById(productId: number): Observable<MenuItem> {
    return this.http.get<MenuItem>(`${this.apiUrl}/${productId}`);
  }
}
