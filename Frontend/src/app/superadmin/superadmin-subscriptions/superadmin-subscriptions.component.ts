import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Tenant, SuperadminService } from '../superadmin.service';
import { BadgeVariant } from 'src/app/shared/components/badge/badge.component';

@Component({
  selector: 'app-superadmin-subscriptions',
  templateUrl: './superadmin-subscriptions.component.html'
})
export class SuperadminSubscriptionsComponent implements OnInit {
  tenants: Tenant[] = [];
  loading = true;
  error = false;
  savingId: string | null = null;
  extendingId: string | null = null;

  // Inline edit state per tenant
  editing: Record<string, { plan: string; status: string }> = {};

  readonly plans = ['BASIC', 'PRO', 'ENTERPRISE'];
  readonly statuses = ['TRIAL', 'ACTIVE', 'SUSPENDED'];

  filterPlan = '';
  filterStatus = '';
  searchTerm = '';

  constructor(
    private superadminService: SuperadminService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = false;
    this.superadminService.getTenants().subscribe({
      next: (data) => {
        this.tenants = data;
        this.editing = {};
        data.forEach(t => {
          this.editing[t.id] = { plan: t.subscriptionPlan, status: t.subscriptionStatus };
        });
        this.loading = false;
      },
      error: () => { this.error = true; this.loading = false; }
    });
  }

  get filtered(): Tenant[] {
    const term = this.searchTerm.toLowerCase();
    return this.tenants.filter(t =>
      (!term || t.name.toLowerCase().includes(term) || t.slug.toLowerCase().includes(term)) &&
      (!this.filterPlan || t.subscriptionPlan === this.filterPlan) &&
      (!this.filterStatus || t.subscriptionStatus === this.filterStatus)
    );
  }

  isDirty(t: Tenant): boolean {
    const e = this.editing[t.id];
    return e && (e.plan !== t.subscriptionPlan || e.status !== t.subscriptionStatus);
  }

  save(t: Tenant): void {
    const e = this.editing[t.id];
    if (!e) return;
    this.savingId = t.id;
    this.superadminService.updateSubscription(t.id, e.plan, e.status).subscribe({
      next: (updated) => {
        const idx = this.tenants.findIndex(x => x.id === updated.id);
        if (idx !== -1) {
          this.tenants[idx] = updated;
          this.editing[updated.id] = { plan: updated.subscriptionPlan, status: updated.subscriptionStatus };
        }
        this.savingId = null;
        this.toastr.success(`${updated.name} subscription updated`);
      },
      error: () => { this.savingId = null; this.toastr.error('Failed to update subscription'); }
    });
  }

  reset(t: Tenant): void {
    this.editing[t.id] = { plan: t.subscriptionPlan, status: t.subscriptionStatus };
  }

  extendTrial(t: Tenant): void {
    this.extendingId = t.id;
    this.superadminService.extendTrial(t.id, 7).subscribe({
      next: (updated) => {
        const idx = this.tenants.findIndex(x => x.id === updated.id);
        if (idx !== -1) {
          this.tenants[idx] = updated;
          this.editing[updated.id] = { plan: updated.subscriptionPlan, status: updated.subscriptionStatus };
        }
        this.extendingId = null;
        this.toastr.success(`Trial extended by 7 days for ${updated.name}`);
      },
      error: () => { this.extendingId = null; this.toastr.error('Failed to extend trial'); }
    });
  }

  statusBadge(status: string): BadgeVariant {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'SUSPENDED': return 'danger';
      default: return 'warning';
    }
  }

  planBadge(plan: string): BadgeVariant {
    switch (plan) {
      case 'ENTERPRISE': return 'primary';
      case 'PRO': return 'neutral';
      default: return 'neutral';
    }
  }

  // Distribution counts
  countByPlan(plan: string): number {
    return this.tenants.filter(t => t.subscriptionPlan === plan).length;
  }

  countByStatus(status: string): number {
    return this.tenants.filter(t => t.subscriptionStatus === status).length;
  }

  trackById(_: number, t: Tenant): string { return t.id; }
}
