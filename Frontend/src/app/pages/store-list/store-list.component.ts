import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
  address?: string;
  phone?: string;
}

@Component({
  selector: 'app-store-list',
  templateUrl: './store-list.component.html',
  styleUrls: ['./store-list.component.scss']
})
export class StoreListComponent implements OnInit {
  stores: StoreSummary[] = [];
  isLoading = true;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.http.get<StoreSummary[]>(`${environment.apiUrl}/api/tenants/active`).subscribe({
      next: (stores) => {
        this.stores = stores;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  goToStore(slug: string): void {
    if (!slug) return;
    this.router.navigate(['/store', slug]);
  }

  getLogoUrl(store: StoreSummary): string {
    if (!store.logoUrl) return '';
    return store.logoUrl.startsWith('http') ? store.logoUrl : `${environment.apiUrl}${store.logoUrl}`;
  }
}
