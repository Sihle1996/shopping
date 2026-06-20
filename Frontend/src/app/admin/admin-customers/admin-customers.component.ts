import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface CustomerSummary {
  email: string;
  name: string | null;
  phone: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  registered: boolean;
}

@Component({
  selector: 'app-admin-customers',
  templateUrl: './admin-customers.component.html'
})
export class AdminCustomersComponent implements OnInit {
  customers: CustomerSummary[] = [];
  filtered: CustomerSummary[] = [];
  loading = true;
  search = '';

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<CustomerSummary[]>(environment.apiUrl + '/api/admin/customers').subscribe({
      next: c => { this.customers = c; this.applyFilter(); this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.filtered = !q ? this.customers : this.customers.filter(c =>
      c.email.toLowerCase().includes(q) || (c.name ?? '').toLowerCase().includes(q));
  }

  get totalRevenue(): number { return this.customers.reduce((s, c) => s + c.totalSpent, 0); }
  initial(c: CustomerSummary): string { return (c.name || c.email).charAt(0).toUpperCase(); }
}
