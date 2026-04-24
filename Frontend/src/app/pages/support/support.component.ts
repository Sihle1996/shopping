import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  adminNotes?: string;
  createdAt: string;
  orderId?: string;
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

  private get headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.auth.getToken()}`
    });
  }

  constructor(private http: HttpClient, private auth: AuthService, private toastr: ToastrService) {}

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
