import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';

export interface GroupCartItem {
  id: string;
  addedBy: { id: string; fullName: string; email: string };
  menuItem: { id: string; name: string; price: number; image?: string };
  quantity: number;
  unitPrice: number;
  selectedChoicesJson?: string;
  itemNotes?: string;
  addedAt: string;
}

export interface GroupCartSummary {
  id: string;
  token: string;
  status: string;
  ownerName: string;
  storeName: string;
  storeSlug: string;
  items: GroupCartItem[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class GroupCartService {
  private api = `${environment.apiUrl}/api/group-cart`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers(): HttpHeaders {
    const h: any = {};
    const token = this.auth.getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    const tenantId = localStorage.getItem('tenantId');
    if (tenantId) h['X-Tenant-Id'] = tenantId;
    return new HttpHeaders(h);
  }

  create(): Observable<{ token: string; id: string }> {
    return this.http.post<{ token: string; id: string }>(this.api, {}, { headers: this.headers() });
  }

  get(token: string): Observable<GroupCartSummary> {
    return this.http.get<GroupCartSummary>(`${this.api}/${token}`);
  }

  addItem(token: string, menuItemId: string, quantity: number,
          selectedChoicesJson?: string | null, itemNotes?: string | null): Observable<GroupCartItem> {
    const body: any = { menuItemId, quantity };
    if (selectedChoicesJson) body.selectedChoicesJson = selectedChoicesJson;
    if (itemNotes) body.itemNotes = itemNotes;
    return this.http.post<GroupCartItem>(`${this.api}/${token}/items`, body, { headers: this.headers() });
  }

  removeItem(token: string, itemId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${token}/items/${itemId}`, { headers: this.headers() });
  }

  close(token: string): Observable<any> {
    return this.http.post(`${this.api}/${token}/close`, {}, { headers: this.headers() });
  }
}
