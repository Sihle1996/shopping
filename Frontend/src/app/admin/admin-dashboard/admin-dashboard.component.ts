import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AdminService } from 'src/app/services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
;

totalOrders: number = 0;
totalRevenue: number = 0;
pendingOrders: number = 0;

constructor(private adminService: AdminService) {}

ngOnInit(): void {
  this.loadStats();
}

loadStats() {
  this.adminService.getDashboardStats().subscribe({
    next: (stats) => {
      this.totalOrders = stats.totalOrders;
      this.totalRevenue = stats.totalRevenue;
      this.pendingOrders = stats.pendingOrders;
    },
    error: () => {
      console.error('Error loading admin stats');
    }
  });
}
}
