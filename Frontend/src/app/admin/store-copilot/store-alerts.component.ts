import { Component, OnDestroy, OnInit } from '@angular/core';
import { AdminAiService, AiAlert } from 'src/app/services/admin-ai.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-store-alerts',
  templateUrl: './store-alerts.component.html'
})
export class StoreAlertsComponent implements OnInit, OnDestroy {
  open = false;
  alerts: AiAlert[] = [];
  loading = true;
  applyingId: string | null = null;

  // Daily briefing (lives here now — open the bell to read it)
  briefing = '';
  briefingLoading = true;

  // Transient "peek": alerts pop out, then glide back into the bell
  peeking = false;
  peekClosing = false;
  peekAlerts: AiAlert[] = [];
  private timers: any[] = [];

  constructor(private ai: AdminAiService, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.load(true); // peek on first load
    this.loadBriefing();
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
  }

  get count(): number { return this.alerts.length; }

  load(peek = false): void {
    this.loading = true;
    this.ai.alerts().subscribe({
      next: (a) => { this.alerts = a || []; this.loading = false; if (peek) this.triggerPeek(); },
      error: () => { this.loading = false; }
    });
  }

  /** Pop only the IMPORTANT (high-severity) alerts out, then glide them into the bell. */
  private triggerPeek(): void {
    if (this.open) return;
    const important = this.alerts.filter(a => a.severity === 'high').slice(0, 3);
    if (important.length === 0) return;
    this.peekAlerts = important;
    this.peeking = true;
    this.peekClosing = false;
    this.timers.push(setTimeout(() => {
      this.peekClosing = true; // start the shrink/fade-into-bell animation
      this.timers.push(setTimeout(() => { this.peeking = false; this.peekAlerts = []; }, 500));
    }, 5200));
  }

  private endPeek(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.peeking = false;
    this.peekClosing = false;
    this.peekAlerts = [];
  }

  loadBriefing(): void {
    this.briefingLoading = true;
    this.ai.briefing().subscribe({
      next: (r) => { this.briefing = r.briefing || ''; this.briefingLoading = false; },
      error: () => { this.briefingLoading = false; }
    });
  }

  refresh(): void {
    this.load();
    this.loadBriefing();
  }

  toggle(): void {
    this.endPeek();
    this.open = !this.open;
    if (this.open) this.refresh();
  }

  apply(a: AiAlert): void {
    if (!a.action || this.applyingId) return;
    this.applyingId = a.id;
    this.ai.applyAlert(a.id).subscribe({
      next: (r) => {
        this.applyingId = null;
        if (r.ok) {
          this.toastr.success(r.message, 'Done');
          this.alerts = this.alerts.filter(x => x !== a);
        } else {
          this.toastr.error(r.message);
        }
      },
      error: () => { this.applyingId = null; this.toastr.error('Could not apply that.'); }
    });
  }

  dismiss(a: AiAlert): void {
    this.ai.dismissAlert(a.id).subscribe({ error: () => {} });
    this.alerts = this.alerts.filter(x => x !== a);
  }

  icon(sev: string): string {
    return sev === 'high' ? 'bi-exclamation-octagon-fill'
         : sev === 'medium' ? 'bi-exclamation-triangle-fill'
         : 'bi-trophy-fill';
  }

  iconColor(sev: string): string {
    return sev === 'high' ? 'text-danger'
         : sev === 'medium' ? 'text-amber-500'
         : 'text-primary';
  }
}
