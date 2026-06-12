import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { AdminAiService } from 'src/app/services/admin-ai.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';
import { TabItem } from 'src/app/shared/components/tabbed-list/tabbed-list.component';

interface SupportMsg { senderRole: string; senderEmail?: string; body: string; createdAt: string; }

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
  orderId?: string;
  user?: { email?: string; fullName?: string };
  messages?: SupportMsg[];
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

  // Tier-3: this store's own requests to CraveIt (payouts, disputes, policy)
  platformTickets: any[] = [];
  showPlatformForm = false;
  submittingPlatform = false;
  platformForm = { subject: '', message: '' };

  replyDrafts: { [id: string]: string } = {};
  sendingReply: { [id: string]: boolean } = {};

  // AI draft
  aiDrafting = false;
  aiCategory = '';
  aiUrgency = '';
  aiResolution = '';

  readonly statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  // Status filter for the list
  statusFilter = 'ALL';
  get filteredTickets(): SupportTicket[] {
    return this.statusFilter === 'ALL' ? this.tickets : this.tickets.filter(t => t.status === this.statusFilter);
  }
  countByStatus(s: string): number {
    return this.tickets.filter(t => t.status === s).length;
  }
  get statusTabs(): TabItem[] {
    return [
      { key: 'ALL', label: 'All', count: this.tickets.length },
      ...this.statuses.map(s => ({ key: s, label: this.statusLabel(s), count: this.countByStatus(s), disabled: this.countByStatus(s) === 0 })),
    ];
  }

  private get headers(): HttpHeaders {
    const h: any = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.auth.getToken()}` };
    const tid = localStorage.getItem('tenantId');
    if (tid) h['X-Tenant-Id'] = tid;
    return new HttpHeaders(h);
  }

  constructor(private http: HttpClient, private auth: AuthService,
              private ai: AdminAiService, private toastr: ToastrService) {}

  ngOnInit(): void { this.load(); this.loadPlatform(); this.ai.aiStatus().subscribe(); }

  load(): void {
    this.loading = true;
    this.http.get<SupportTicket[]>(`${environment.apiUrl}/api/admin/support`, { headers: this.headers })
      .subscribe({ next: t => { this.tickets = t; this.loading = false; }, error: () => this.loading = false });
  }

  loadPlatform(): void {
    this.http.get<any[]>(`${environment.apiUrl}/api/admin/support/platform`, { headers: this.headers })
      .subscribe({ next: t => this.platformTickets = t, error: () => {} });
  }

  sendThreadReply(id: string): void {
    const body = (this.replyDrafts[id] || '').trim();
    if (!body) return;
    this.sendingReply[id] = true;
    this.http.post<any>(`${environment.apiUrl}/api/admin/support/${id}/message`, { body }, { headers: this.headers })
      .subscribe({
        next: updated => {
          this.replyDrafts[id] = '';
          this.sendingReply[id] = false;
          this.tickets = this.tickets.map(t => t.id === id ? updated : t);
          this.platformTickets = this.platformTickets.map(t => t.id === id ? updated : t);
          if (this.selected?.id === id) this.selected = updated;
        },
        error: () => { this.sendingReply[id] = false; this.toastr.error('Could not send reply'); }
      });
  }

  roleLabel(r: string): string { return r === 'PLATFORM' ? 'CraveIt' : r === 'STORE' ? 'You' : 'Customer'; }

  submitPlatform(): void {
    if (!this.platformForm.subject.trim() || !this.platformForm.message.trim()) { this.toastr.warning('Add a subject and message'); return; }
    this.submittingPlatform = true;
    this.http.post(`${environment.apiUrl}/api/admin/support/platform`, this.platformForm, { headers: this.headers })
      .subscribe({
        next: () => {
          this.submittingPlatform = false; this.showPlatformForm = false;
          this.platformForm = { subject: '', message: '' };
          this.toastr.success('Sent to CraveIt — their reply will appear here.');
          this.loadPlatform();
        },
        error: () => { this.submittingPlatform = false; this.toastr.error('Could not send. Please try again.'); }
      });
  }

  open(t: SupportTicket): void {
    this.selected = t;
    this.draftNotes = t.adminNotes ?? '';
    this.draftStatus = t.status;
    this.aiCategory = ''; this.aiUrgency = ''; this.aiResolution = '';
  }

  close(): void { this.selected = null; }

  /** Ask the AI to triage the ticket and draft a customer reply into the notes box. */
  draftWithAi(): void {
    if (!this.selected || this.aiDrafting) return;
    if (this.ai.isAiOff()) {
      this.toastr.info('Vision is off — drafting a basic template. Add an Anthropic API key (ANTHROPIC_API_KEY) for Vision-written replies.');
    }
    this.aiDrafting = true;
    this.ai.draftSupport(this.selected.subject, this.selected.message, this.selected.orderId).subscribe({
      next: (d) => {
        this.aiDrafting = false;
        this.aiCategory = d.category || '';
        this.aiUrgency = d.urgency || '';
        this.aiResolution = d.suggestedResolution || '';
        // Prefill the reply; keep any existing notes below it.
        this.draftNotes = (d.draftReply || '').trim() +
          (this.draftNotes ? '\n\n— previous notes —\n' + this.draftNotes : '');
        if (d.suggestedStatus && this.statuses.includes(d.suggestedStatus)) {
          this.draftStatus = d.suggestedStatus;
        }
        this.toastr.success('Drafted a reply — review and edit before saving', 'Vision');
      },
      error: () => { this.aiDrafting = false; this.toastr.error('Vision draft unavailable right now'); }
    });
  }

  urgencyClass(u: string): string {
    return ({ high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-800', low: 'bg-emerald-100 text-emerald-700' } as any)[u] ?? 'bg-gray-100 text-gray-600';
  }

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

  /** Rounded-pill accent colour per status (gives the list colour at a glance). */
  statusBar(s: string): string {
    return ({
      OPEN: 'bg-amber-400',
      IN_PROGRESS: 'bg-blue-400',
      RESOLVED: 'bg-emerald-400',
      CLOSED: 'bg-gray-300'
    } as any)[s] ?? 'bg-gray-300';
  }
}
