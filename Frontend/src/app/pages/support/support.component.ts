import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

interface SupportMsg {
  senderRole: string;
  senderEmail?: string;
  body: string;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  adminNotes?: string;
  createdAt: string;
  orderId?: string;
  escalated?: boolean;
  escalationReason?: string;
  messages?: SupportMsg[];
}

@Component({
  selector: 'app-support',
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent implements OnInit {
  tickets: SupportTicket[] = [];
  loading = false;
  submitting = false;

  form = { subject: '', message: '', orderId: '' };
  formSubmitted = false;

  replyDrafts: { [id: string]: string } = {};
  sendingReply: { [id: string]: boolean } = {};

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.auth.getToken()}`
    });
  }

  constructor(private http: HttpClient, private auth: AuthService, private toastr: ToastrService, private router: Router) {}

  goBack(): void {
    const slug = localStorage.getItem('storeSlug');
    this.router.navigate(slug ? ['/store', slug] : ['/stores']);
  }

  ngOnInit(): void {
    this.loadTickets();
  }

  loadTickets(): void {
    this.loading = true;
    this.http.get<SupportTicket[]>(`${environment.apiUrl}/api/support/my`, { headers: this.headers })
      .subscribe({
        next: t => { this.tickets = t; this.loading = false; },
        error: () => this.loading = false
      });
  }

  submit(): void {
    this.formSubmitted = true;
    if (!this.form.subject.trim() || !this.form.message.trim()) return;
    this.submitting = true;
    this.http.post<SupportTicket>(`${environment.apiUrl}/api/support`, this.form, { headers: this.headers })
      .subscribe({
        next: ticket => {
          this.tickets.unshift(ticket);
          this.form = { subject: '', message: '', orderId: '' };
          this.formSubmitted = false;
          this.submitting = false;
          this.toastr.success('Your ticket has been submitted. We\'ll get back to you soon.');
        },
        error: () => {
          this.submitting = false;
          this.toastr.error('Failed to submit ticket. Please try again.');
        }
      });
  }

  escalate(t: SupportTicket): void {
    const reason = (prompt('Tell CraveIt what went wrong with this store (optional):') ?? '').trim();
    this.http.post<SupportTicket>(`${environment.apiUrl}/api/support/${t.id}/escalate`, { reason }, { headers: this.headers })
      .subscribe({
        next: updated => { Object.assign(t, updated); this.toastr.success('Escalated to CraveIt — we\'ll review how this store handled you.'); },
        error: e => this.toastr.error(e?.error?.error || 'Could not escalate. Please try again.')
      });
  }

  sendReply(t: SupportTicket): void {
    const body = (this.replyDrafts[t.id] || '').trim();
    if (!body) return;
    this.sendingReply[t.id] = true;
    this.http.post<SupportTicket>(`${environment.apiUrl}/api/support/${t.id}/message`, { body }, { headers: this.headers })
      .subscribe({
        next: updated => {
          const i = this.tickets.findIndex(x => x.id === t.id);
          if (i >= 0) this.tickets[i] = updated;
          this.replyDrafts[t.id] = '';
          this.sendingReply[t.id] = false;
        },
        error: () => { this.sendingReply[t.id] = false; this.toastr.error('Could not send your reply.'); }
      });
  }

  roleLabel(r: string): string { return r === 'PLATFORM' ? 'CraveIt' : r === 'STORE' ? 'Store' : 'You'; }

  statusLabel(s: string): string {
    return { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CLOSED: 'Closed' }[s] ?? s;
  }

  statusClass(s: string): string {
    return {
      OPEN: 'bg-amber-100 text-amber-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      RESOLVED: 'bg-emerald-100 text-emerald-800',
      CLOSED: 'bg-gray-100 text-gray-600'
    }[s] ?? '';
  }
}
