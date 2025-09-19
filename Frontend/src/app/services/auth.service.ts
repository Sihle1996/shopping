import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { Observable, tap } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'token'; 
  private apiUrlAuth = "http://localhost:8080/api"; 

  constructor(private http: HttpClient, private router: Router) {}

  
  register(data: { email: string; password: string; confirmPassword: string }): Observable<any> {
    return this.http.post(`${this.apiUrlAuth}/register`, data);
  }

  
  login(credentials: { email: string; password: string }): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.apiUrlAuth}/login`, credentials).pipe(
      tap(response => {
        console.log("Login response:", response); 

        if (response.token) {
          localStorage.setItem(this.tokenKey, response.token);
          this.extractUserIdFromToken(response.token); 
        }
      })
    );
  }

 
  private extractUserIdFromToken(token: string): void {
    try {
      const decodedToken: any = jwtDecode(token);
      if (decodedToken && decodedToken.userId) {
        localStorage.setItem('userId', decodedToken.userId.toString());
        console.log("Extracted userId:", decodedToken.userId);
      } else {
        console.warn("⚠️ Warning: userId not found in token.");
      }
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  }

  e
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  
  getUserId(): number | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const decodedToken: any = jwtDecode(token);
      return decodedToken.userId ? Number(decodedToken.userId) : null;
    } catch (error) {
      console.error("Error extracting userId:", error);
      return null;
    }
  }

  
  isLoggedIn(): boolean {
    return !!this.getToken() && !!this.getUserId();
  }

  
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('userId');
    this.router.navigate(['/login']);
  }

  getUserRole(): string | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload: any = jwtDecode(token);
      console.log("Decoded Role:", payload.role);
      return payload.role || null;
    } catch (error) {
      console.error("Error decoding role:", error);
      return null;
    }
  }
  
  
}
