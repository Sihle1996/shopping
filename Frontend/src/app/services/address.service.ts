import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface UserAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

export interface AddressRequest {
  label: string;
  street: string;
  city: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

@Injectable({ providedIn: 'root' })
export class AddressService {
  private api = `${environment.apiUrl}/api/addresses`;

  constructor(private http: HttpClient) {}

  list(): Observable<UserAddress[]> {
    return this.http.get<UserAddress[]>(this.api);
  }

  create(req: AddressRequest): Observable<UserAddress> {
    return this.http.post<UserAddress>(this.api, req);
  }

  update(id: string, req: AddressRequest): Observable<UserAddress> {
    return this.http.put<UserAddress>(`${this.api}/${id}`, req);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
