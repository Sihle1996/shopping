import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { environment } from 'src/environments/environment';

interface BookItem {
  name: string;
  units: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPercent: number | null;
  estimated: boolean;
}

interface CategoryLine {
  category: string;
  revenue: number;
  cogs: number;
  profit: number;
  marginPercent: number | null;
}

interface DayPoint {
  date: string;
  revenue: number;
  cogs: number;
  profit: number;
}

interface MoneyIn {
  days: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number | null;
  estimatedSharePercent: number;
  orders: number;
  items: BookItem[];
  cogsByCategory: CategoryLine[];
  platformCommission: number;
  netProfit: number;
  netMarginPercent: number | null;
  dailyProfit: DayPoint[];
}

@Component({
  selector: 'app-admin-books',
  templateUrl: './admin-books.component.html',
})
export class AdminBooksComponent implements OnInit {
  data: MoneyIn | null = null;
  loading = false;
  locked = false;          // plan doesn't include Books
  lockedMessage = '';
  days = 30;
  readonly ranges = [7, 30, 90];

  // Food-margin health bands (gross margin %): at/above GOOD is healthy, below OK is thin.
  private readonly MARGIN_GOOD = 60;
  private readonly MARGIN_OK = 30;

  private get headers(): HttpHeaders {
    const h: any = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.auth.getToken()}` };
    const tid = localStorage.getItem('tenantId');
    if (tid) h['X-Tenant-Id'] = tid;
    return new HttpHeaders(h);
  }

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit(): void { this.load(); }

  setRange(d: number): void {
    if (this.days === d) return;
    this.days = d;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.locked = false;
    this.http.get<MoneyIn>(`${environment.apiUrl}/api/admin/books/money-in?days=${this.days}`, { headers: this.headers })
      .subscribe({
        next: d => { this.data = d; this.loading = false; },
        error: (e) => {
          this.loading = false;
          if (e?.status === 403) {
            this.locked = true;
            this.lockedMessage = e?.error?.message || 'CraveIt Books is a PRO feature.';
          }
        }
      });
  }

  /** Bar width (0–100%) for an item's profit, relative to the most profitable item. */
  barWidth(item: BookItem): number {
    const max = Math.max(1, ...(this.data?.items || []).map(i => Math.max(0, i.profit)));
    return Math.max(2, Math.round(Math.max(0, item.profit) / max * 100));
  }

  /** Bar width (0–100%) for a category's COGS, relative to the largest category. */
  catBarWidth(cat: CategoryLine): number {
    const max = Math.max(1, ...(this.data?.cogsByCategory || []).map(c => c.revenue));
    return Math.max(2, Math.round(cat.revenue / max * 100));
  }

  /** Vertical bar height (0–100%) for a day's profit in the trend chart. */
  dayBarHeight(d: DayPoint): number {
    const max = Math.max(1, ...(this.data?.dailyProfit || []).map(p => Math.max(0, p.profit)));
    return Math.max(3, Math.round(Math.max(0, d.profit) / max * 100));
  }

  /** Short day-of-month label for a trend bar (e.g. "7 Jun"). */
  dayLabel(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d.getTime()) ? iso : `${d.getDate()}`;
  }

  /** Commission as a % of revenue, for the P&L line. */
  get commissionPercent(): number | null {
    if (!this.data || this.data.revenue <= 0) return null;
    return this.data.platformCommission / this.data.revenue * 100;
  }

  marginClass(m: number | null): string {
    if (m == null) return 'text-textMuted';
    if (m >= this.MARGIN_GOOD) return 'text-emerald-600';
    if (m >= this.MARGIN_OK) return 'text-amber-600';
    return 'text-red-600';
  }
}
