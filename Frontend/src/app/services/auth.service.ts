import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { Observable, tap } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'token'; // Key for localStorage where the token is stored
  private apiUrlAuth = "http://localhost:8080/api"; // Backend authentication API

  constructor(private http: HttpClient, private router: Router) {}

  // ✅ User Registration
  register(data: { email: string; password: string; confirmPassword: string }): Observable<any> {
    return this.http.post(`${this.apiUrlAuth}/register`, data);
  }

  // ✅ User Login - Extracts token & userId from JWT
  login(credentials: { email: string; password: string }): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.apiUrlAuth}/login`, credentials).pipe(
      tap(response => {
        console.log("Login response:", response); // ✅ Debugging log

        if (response.token) {
          localStorage.setItem(this.tokenKey, response.token);
          this.extractUserIdFromToken(response.token); // ✅ Extract userId from token
        }
      })
    );
  }

  // ✅ Extract userId from the JWT token
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

  // ✅ Retrieve JWT token from LocalStorage
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // ✅ Get userId from LocalStorage (or decode if missing)
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

  // ✅ Check if user is logged in
  isLoggedIn(): boolean {
    return !!this.getToken() && !!this.getUserId();
  }

  // ✅ Logout user (Clear token & redirect)
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('userId');
    this.router.navigate(['/login']); // Redirect user to login page
  }

  getUserRole(): string | null {
    const token = this.getToken();
    if (!token) return null;
  
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log("Decoded Role:", payload.role); // ✅ Debug log
      return payload.role || null;
    } catch (error) {
      console.error("Error decoding role:", error);
      return null;
    }
  }
  
  
}
