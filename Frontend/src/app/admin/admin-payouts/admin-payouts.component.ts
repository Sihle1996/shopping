import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';
import { TabItem } from 'src/app/shared/components/tabbed-list/tabbed-list.component';

interface Payout {
  id: string;
  periodStart?: string;
  periodEnd?: string;
  grossRevenue: number;
  platformFeePercent: number;
  platformFee: number;
  netAmount: number;
  status: 'PENDING' | 'PAID' | 'ON_HOLD';
  createdAt: string;
  paidAt?: string;
  reference?: string;
  notes?: string;
}

@Component({
  selector: 'app-admin-payouts',
  templateUrl: './admin-payouts.component.html',
  styleUrls: ['./admin-payouts.component.scss']
})
export class AdminPayoutsComponent implements OnInit {
  payouts: Payout[] = [];
  loading = false;

  private get headers(): HttpHeaders {
    const h: any = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.auth.getToken()}` };
    const tid = localStorage.getItem('tenantId');
    if (tid) h['X-Tenant-Id'] = tid;
    return new HttpHeaders(h);
  }

  constructor(private http: HttpClient, private auth: AuthService, private toastr: ToastrService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.http.get<Payout[]>(`${environment.apiUrl}/api/admin/payouts`, { headers: this.headers })
      .subscribe({ next: p => { this.payouts = p; this.loading = false; }, error: () => this.loading = false });
  }

  get totalEarned(): number { return this.payouts.reduce((s, p) => s + p.grossRevenue, 0); }
  get totalReceived(): number { return this.payouts.filter(p => p.status === 'PAID').reduce((s, p) => s + p.netAmount, 0); }
  get totalPending(): number { return this.payouts.filter(p => p.status === 'PENDING').reduce((s, p) => s + p.netAmount, 0); }

  statusClass(s: string): string {
    return ({ PENDING: 'bg-amber-100 text-amber-800', PAID: 'bg-emerald-100 text-emerald-800', ON_HOLD: 'bg-red-100 text-red-700' } as any)[s] ?? '';
  }
  /** Refunds (cancelled-order debits) deducted this period — the gap between gross−fee and net.
   *  Derived so the row reconciles: gross − platform fee − refunds = net. */
  refunds(p: Payout): number {
    return Math.max(0, +(p.grossRevenue - p.platformFee - p.netAmount).toFixed(2));
  }

  /** Rounded-pill row accent colour per status. */
  statusAccent(s: string): string {
    return ({ PENDING: 'bg-amber-400', PAID: 'bg-emerald-400', ON_HOLD: 'bg-red-400' } as any)[s] ?? 'bg-gray-300';
  }

  // ── Status filter (within the page) ──
  statusFilter: 'ALL' | 'PENDING' | 'PAID' | 'ON_HOLD' = 'ALL';
  get statusTabs(): TabItem[] {
    const c = (s: string) => this.payouts.filter(p => p.status === s).length;
    return [
      { key: 'ALL',     label: 'All',     count: this.payouts.length },
      { key: 'PENDING', label: 'Pending', count: c('PENDING') },
      { key: 'PAID',    label: 'Paid',    count: c('PAID') },
      { key: 'ON_HOLD', label: 'On hold', count: c('ON_HOLD'), disabled: c('ON_HOLD') === 0 },
    ];
  }
  get filteredPayouts(): Payout[] {
    return this.statusFilter === 'ALL' ? this.payouts : this.payouts.filter(p => p.status === this.statusFilter);
  }
}
