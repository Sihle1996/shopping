import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CartItem } from './cart.service';

export interface ComboItemDetail {
  menuItemId: string;
  role: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

export interface ComboSummary {
  id: string;
  name: string;
  description: string;
  source: string;
  comboPrice: number;
  originalPrice: number;
  savings: number;
  imageUrl: string;
  items: ComboItemDetail[];
}

@Injectable({ providedIn: 'root' })
export class ComboService {
  private readonly base = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  getCombosForItem(itemId: string): Observable<ComboSummary[]> {
    return this.http.get<ComboSummary[]>(`${this.base}/intelligence/combos`, { params: { itemId } });
  }

  getAllCombos(): Observable<ComboSummary[]> {
    return this.http.get<ComboSummary[]>(`${this.base}/intelligence/combos`);
  }

  addComboToCart(comboId: string): Observable<CartItem[]> {
    return this.http.post<CartItem[]>(`${this.base}/cart/add-combo`, { comboId });
  }
}
