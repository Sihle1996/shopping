import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface AssistantInterpretation {
  servings: number;
  budgetPerPerson: number | null;
  totalBudget: number | null;
  tags: string[];
  confidence: number;
}

export interface AssistantItem {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface AssistantSuggestion {
  mode: string;
  items: AssistantItem[];
  totalEstimate: number;
  message: string;
}

export interface AssistantResponse {
  interpretation: AssistantInterpretation;
  suggestion: AssistantSuggestion;
  alternatives: AssistantSuggestion[];
  suggestionToken: string;
}

@Injectable({ providedIn: 'root' })
export class OrderAssistantService {
  private readonly base = `${environment.apiUrl}/api/intelligence`;

  constructor(private http: HttpClient) {}

  interpret(prompt: string, lat?: number, lon?: number): Observable<AssistantResponse> {
    return this.http.post<AssistantResponse>(`${this.base}/order-for-me`, { prompt, lat, lon });
  }

  confirm(token: string): Observable<any[]> {
    return this.http.post<any[]>(`${this.base}/order-for-me/confirm`, { suggestionToken: token });
  }
}
