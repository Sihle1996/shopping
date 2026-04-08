import { Component, OnInit } from '@angular/core';
import { PlatformStats, SuperadminService } from '../superadmin.service';

@Component({
  selector: 'app-superadmin-dashboard',
  templateUrl: './superadmin-dashboard.component.html',
  styleUrls: ['./superadmin-dashboard.component.scss']
})
export class SuperadminDashboardComponent implements OnInit {
  stats: PlatformStats = {
    totalTenants: 0, activeTenants: 0, totalOrders: 0, totalRevenue: 0,
    planBreakdown: {}, statusBreakdown: {}, recentTenants: []
  };
  loading = true;
  error = false;

  constructor(private superadminService: SuperadminService) {}

  ngOnInit(): void { this.loadStats(); }

  loadStats(): void {
    this.loading = true;
    this.error = false;
    this.superadminService.getStats().subscribe({
      next: (data) => { this.stats = data; this.loading = false; },
      error: () => { this.error = true; this.loading = false; }
    });
  }

  planColor(plan: string): string {
    switch (plan) {
      case 'ENTERPRISE': return 'text-violet-600 bg-violet-50';
      case 'PRO': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-100';
    }
  }

  statusColor(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'text-success bg-green-50';
      case 'SUSPENDED': return 'text-danger bg-red-50';
      default: return 'text-warning bg-amber-50';
    }
  }

  get planEntries(): { key: string; value: number }[] {
    return Object.entries(this.stats.planBreakdown || {})
      .map(([key, value]) => ({ key, value: Number(value) }))
      .sort((a, b) => b.value - a.value);
  }

  get statusEntries(): { key: string; value: number }[] {
    return Object.entries(this.stats.statusBreakdown || {})
      .map(([key, value]) => ({ key, value: Number(value) }))
      .sort((a, b) => b.value - a.value);
  }

  get inactiveCount(): number {
    return this.stats.totalTenants - this.stats.activeTenants;
  }
}
