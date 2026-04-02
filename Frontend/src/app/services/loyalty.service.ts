import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface LoyaltyBalance {
  balance: number;
  cashValue: number;
  minRedemption: number;
}

@Injectable({ providedIn: 'root' })
export class LoyaltyService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  getBalance(): Observable<LoyaltyBalance> {
    return this.http.get<LoyaltyBalance>(`${this.api}/api/loyalty/balance`, { headers: this.headers() });
  }

  getHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/api/loyalty/history`, { headers: this.headers() });
  }

  calculate(points: number): Observable<{ discount: number; pointsUsed: number }> {
    return this.http.post<any>(`${this.api}/api/loyalty/calculate`, { points }, { headers: this.headers() });
  }
}
