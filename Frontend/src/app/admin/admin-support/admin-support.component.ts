import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
  orderId?: string;
  user?: { email?: string; fullName?: string };
}

@Component({
  selector: 'app-admin-support',
  templateUrl: './admin-support.component.html',
  styleUrls: ['./admin-support.component.scss']
})
export class AdminSupportComponent implements OnInit {
  tickets: SupportTicket[] = [];
  loading = false;
  selected: SupportTicket | null = null;
  saving = false;
  draftNotes = '';
  draftStatus = '';

  readonly statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

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
    this.http.get<SupportTicket[]>(`${environment.apiUrl}/api/admin/support`, { headers: this.headers })
      .subscribe({ next: t => { this.tickets = t; this.loading = false; }, error: () => this.loading = false });
  }

  open(t: SupportTicket): void {
    this.selected = t;
    this.draftNotes = t.adminNotes ?? '';
    this.draftStatus = t.status;
  }

  close(): void { this.selected = null; }

  save(): void {
    if (!this.selected) return;
    this.saving = true;
    this.http.patch(`${environment.apiUrl}/api/admin/support/${this.selected.id}`,
      { status: this.draftStatus, adminNotes: this.draftNotes },
      { headers: this.headers }
    ).subscribe({
      next: (updated: any) => {
        this.tickets = this.tickets.map(t => t.id === updated.id ? updated : t);
        this.selected = updated;
        this.saving = false;
        this.toastr.success('Ticket updated');
      },
      error: () => { this.saving = false; this.toastr.error('Failed to update ticket'); }
    });
  }

  statusLabel(s: string): string {
    return { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CLOSED: 'Closed' }[s] ?? s;
  }

  statusClass(s: string): string {
    return ({
      OPEN: 'bg-amber-100 text-amber-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      RESOLVED: 'bg-emerald-100 text-emerald-800',
      CLOSED: 'bg-gray-100 text-gray-600'
    } as any)[s] ?? '';
  }
}
