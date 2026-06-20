import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { driver } from 'driver.js';
import { AdminService } from 'src/app/services/admin.service';
import { AdminAiService } from 'src/app/services/admin-ai.service';
import { ConfirmService } from 'src/app/shared/services/confirm.service';
import { TabItem } from 'src/app/shared/components/tabbed-list/tabbed-list.component';

@Component({
  selector: 'app-admin-drivers',
  templateUrl: './admin-drivers.component.html',
  styleUrls: ['./admin-drivers.component.scss']
})
export class AdminDriversComponent implements OnInit, OnDestroy {
  newDriver = { email: '', password: '' };
  drivers: any[] = [];
  loading = false;
  submitting = false;
  deletingId: string | null = null;
  toast: string | null = null;
  toastType: 'success' | 'error' = 'success';
  driverFormSubmitted = false;

  /** Section tabs — split the long page into Manage (add + list + live map) and Performance (insights). */
  driverTab = 'manage';
  driverTabs: TabItem[] = [
    { key: 'manage', label: 'Manage' },
    { key: 'performance', label: 'Performance' },
  ];

  get driverEmailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.newDriver.email?.trim() || '');
  }

  get driverPasswordValid(): boolean {
    return (this.newDriver.password?.length || 0) >= 6;
  }
  private activeDriver: any = null;

  ngOnDestroy(): void {
    try { this.activeDriver?.destroy(); } catch { /* ignore */ }
  }

  // Driver operations insights (admin scorecard)
  driverInsights: any = null;
  loadDriverInsights(): void {
    this.adminAiService.driverInsights().subscribe({
      next: (d) => this.driverInsights = d,
      error: () => {}
    });
  }

  // Recommendation feedback — is the AI suggestion helping?
  recStats: any = null;
  loadRecStats(): void {
    this.adminAiService.recommendationStats().subscribe({
      next: (s) => this.recStats = s,
      error: () => {}
    });
  }

  constructor(private adminService: AdminService, private route: ActivatedRoute,
              private confirm: ConfirmService, private adminAiService: AdminAiService) {}

  ngOnInit(): void {
    this.loadDrivers();
    this.loadDriverInsights();
    this.loadRecStats();
    const tour = this.route.snapshot.queryParamMap.get('tour');
    if (tour === 'add-driver') {
      setTimeout(() => {
        const el = document.getElementById('add-driver-form');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const d = driver({
            animate: true,
            overlayOpacity: 0.4,
            allowClose: true,
            overlayClickBehavior: 'close',
            onDestroyed: () => { this.activeDriver = null; }
          });
          this.activeDriver = d;
          d.highlight({
            element: '#add-driver-form',
            popover: { title: 'Add a Driver', description: 'Enter your driver\'s email and a password to create their account', side: 'bottom', align: 'start', showButtons: ['close'] }
          });
        }, 400);
      }, 300);
    }
  }

  loadDrivers(): void {
    this.loading = true;
    this.adminService.getDrivers().subscribe({
      next: (drivers: any[]) => {
        this.drivers = drivers;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  addDriver(): void {
    this.driverFormSubmitted = true;
    if (!this.driverEmailValid || !this.driverPasswordValid) return;
    this.submitting = true;
    this.adminService.createDriver(this.newDriver).subscribe({
      next: () => {
        this.newDriver = { email: '', password: '' };
        this.driverFormSubmitted = false;
        this.submitting = false;
        this.showToast('Driver added successfully', 'success');
        this.loadDrivers();
      },
      error: (err: any) => {
        this.submitting = false;
        this.showToast(err?.error?.message || 'Failed to add driver', 'error');
      }
    });
  }

  deleteDriver(id: string): void {
    this.confirm.ask({
      title: 'Remove driver?',
      message: 'This driver will be removed from your store. This cannot be undone.',
      confirmLabel: 'Remove',
    }).subscribe(ok => {
      if (!ok) return;
      this.performDeleteDriver(id);
    });
  }

  private performDeleteDriver(id: string): void {
    this.deletingId = id;
    this.adminService.deleteDriver(id).subscribe({
      next: () => {
        this.drivers = this.drivers.filter((d: any) => d.id !== id);
        this.deletingId = null;
        this.showToast('Driver removed', 'success');
      },
      error: () => {
        this.deletingId = null;
        this.showToast('Failed to remove driver', 'error');
      }
    });
  }

  payingId: string | null = null;

  payoutDriver(d: any): void {
    const owed = d.owedBalance || 0;
    if (owed <= 0) { this.showToast('Nothing owed to this driver yet', 'error'); return; }
    this.confirm.ask({
      title: 'Record payout?',
      message: `Mark R${owed.toFixed(2)} as paid to ${d.email}. This clears their owed balance.`,
      confirmLabel: 'Mark paid',
    }).subscribe(ok => {
      if (!ok) return;
      this.payingId = d.id;
      this.adminService.recordDriverPayout(d.id, owed).subscribe({
        next: (updated: any) => {
          d.owedBalance = updated?.owedBalance ?? 0;
          this.payingId = null;
          this.showToast(`Paid R${owed.toFixed(2)} to ${d.email}`, 'success');
        },
        error: (err: any) => {
          this.payingId = null;
          this.showToast(err?.error?.message || 'Failed to record payout', 'error');
        }
      });
    });
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toast = msg;
    this.toastType = type;
    setTimeout(() => (this.toast = null), 3000);
  }
}
