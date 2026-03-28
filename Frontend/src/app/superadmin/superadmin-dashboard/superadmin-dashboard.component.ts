import { Component, OnInit } from '@angular/core';
import { PlatformStats, SuperadminService } from '../superadmin.service';

@Component({
  selector: 'app-superadmin-dashboard',
  templateUrl: './superadmin-dashboard.component.html',
  styleUrls: ['./superadmin-dashboard.component.scss']
})
export class SuperadminDashboardComponent implements OnInit {
  stats: PlatformStats = { totalTenants: 0, activeTenants: 0, totalOrders: 0, totalRevenue: 0 };
  loading = true;
  error = false;

  constructor(private superadminService: SuperadminService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.error = false;
    this.superadminService.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }
}
