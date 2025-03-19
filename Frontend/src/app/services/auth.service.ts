import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private tokenKey = 'token'; // Key for localStorage where the token is stored
  private apiUrlAuth = "http://localhost:8080/api"
  constructor(private http: HttpClient, private router: Router) {}

  // Method to handle user registration
  register(data: { email: string; password: string; confirmPassword: string }): Observable<any> {
    return this.http.post(`${this.apiUrlAuth}/register`, data);
  }

  // Method to handle user login
  login(credentials: { email: string; password: string }): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.apiUrlAuth}/login`, credentials);
  }

  // Method to save JWT token securely to localStorage
  saveToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  // Method to retrieve JWT token from localStorage
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Method to remove JWT token from localStorage
  clearToken(): void {
    localStorage.removeItem(this.tokenKey);
  }

  // Method to check if user is logged in
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // Method to logout user
  logout(): void {
    this.clearToken();
    this.router.navigate(['/landing']); // Redirect user to landing page
  }

  // Method to extract user ID from JWT token payload
  getUserId(): number | null {
    const token = this.getToken();
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id ? Number(payload.id) : null; // ✅ Ensure it's a number
    }
    return null;
  }

  // Private method to decode JWT token and extract user ID
  private extractUserIdFromToken(token: string): string | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id || null; // Assuming the user ID is stored in the "id" field
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }
}
