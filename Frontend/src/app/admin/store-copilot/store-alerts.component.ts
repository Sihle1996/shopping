import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AdminAiService, AiAlert } from 'src/app/services/admin-ai.service';
import { NotificationService } from 'src/app/services/notification.service';
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

  // Promo economics (last 7 days) — deterministic, reporting-only (NOT the LLM briefing)
  promoEconomics: any[] = [];

  // Transient "peek": alerts pop out, then glide back into the bell
  peeking = false;
  peekClosing = false;
  peekAlerts: AiAlert[] = [];
  private timers: any[] = [];
  private alertSub?: Subscription;

  constructor(private ai: AdminAiService, private toastr: ToastrService,
              private notifications: NotificationService) {}

  ngOnInit(): void {
    this.load(true); // peek on first load
    this.loadBriefing();
    this.loadPromoEconomics();
    // Live: the background scan pushes here when a new alert is raised — reload + peek it,
    // so a scheduled order due soon reaches you without opening the bell.
    const tenantId = localStorage.getItem('tenantId');
    if (tenantId) {
      this.alertSub = this.notifications.subscribeToAdminAlerts(tenantId).subscribe(() => this.load(true));
    }
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
    this.alertSub?.unsubscribe();
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

  loadPromoEconomics(): void {
    this.ai.promoEconomics().subscribe({
      next: (r) => this.promoEconomics = r.promos || [],
      error: () => {}
    });
  }

  // Net-lift verdict + formatting — same vocabulary as the V53.1 card (no second interpretation layer).
  liftStatus(o: any): string {
    if (o?.netRevenueLift == null) return 'INCONCLUSIVE';
    return o.netRevenueLift > 0 ? 'POSITIVE' : o.netRevenueLift < 0 ? 'NEGATIVE' : 'INCONCLUSIVE';
  }
  liftStatusClass(o: any): string {
    return ({ POSITIVE: 'bg-emerald-100 text-emerald-700', NEGATIVE: 'bg-red-100 text-red-700',
              INCONCLUSIVE: 'bg-gray-100 text-gray-600' } as any)[this.liftStatus(o)];
  }
  randSigned(v: number | null): string {
    if (v == null) return 'measuring…';
    return (v > 0 ? '+R' : v < 0 ? '-R' : 'R') + Math.abs(v).toLocaleString('en-ZA');
  }

  refresh(): void {
    this.load();
    this.loadBriefing();
    this.loadPromoEconomics();
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
