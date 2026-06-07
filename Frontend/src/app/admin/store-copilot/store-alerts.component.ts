import { Component, OnInit } from '@angular/core';
import { AdminAiService, AiAlert } from 'src/app/services/admin-ai.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-store-alerts',
  templateUrl: './store-alerts.component.html'
})
export class StoreAlertsComponent implements OnInit {
  open = false;
  alerts: AiAlert[] = [];
  loading = true;
  applyingId: string | null = null;

  // Daily briefing (lives here now — pops up in the notification panel)
  briefing = '';
  briefingLoading = true;

  constructor(private ai: AdminAiService, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.load();
    this.loadBriefing();
    // Pop the panel open once per session so the briefing greets the owner.
    if (!sessionStorage.getItem('copilotBriefingShown')) {
      this.open = true;
      sessionStorage.setItem('copilotBriefingShown', '1');
    }
  }

  get count(): number { return this.alerts.length; }

  load(): void {
    this.loading = true;
    this.ai.alerts().subscribe({
      next: (a) => { this.alerts = a || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
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
