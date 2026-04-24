import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

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
}
