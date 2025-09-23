import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { AnalyticsService } from './analytics.service';
import { AdminService } from 'src/app/services/admin.service';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
  startDate!: string;
  endDate!: string;

  salesChart?: Chart;
  productsChart?: Chart;
  @ViewChild('salesChartCanvas') salesChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('productsChartCanvas') productsChartCanvas!: ElementRef<HTMLCanvasElement>;
  salesEmpty = false;
  productsEmpty = false;
  topProducts: any[] = [];
  aov = 0;
  onTime = 0;
  cancellations = 0;
  totalOrders = 0;
  totalRevenue = 0;
  pendingOrders = 0;

  constructor(private analyticsService: AnalyticsService, private adminService: AdminService) {}

  ngOnInit(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    this.startDate = start.toISOString().substring(0, 10);
    this.endDate = now.toISOString().substring(0, 10);
    this.loadStats();
  }

  ngAfterViewInit(): void {
    // Defer to next microtask to ensure canvases are attached to DOM
    Promise.resolve().then(() => {
      console.log('[AdminDashboard] View initialized. Canvas refs:', {
        salesCanvas: !!this.salesChartCanvas?.nativeElement,
        productsCanvas: !!this.productsChartCanvas?.nativeElement,
      });
      this.loadAnalytics();
    });
  }

  loadAnalytics(): void {
    // Use date-only strings expected by the backend (avoid timezone shifting)
    const start = this.startDate; // format yyyy-MM-dd
    const end = this.endDate;     // format yyyy-MM-dd

    this.analyticsService.getSalesTrends(start, end).subscribe({
      next: (data) => {
        const labels = data.map(d => d.date);
        const values = data.map(d => d.total);
        console.log('[AdminDashboard] Sales trends data:', { count: data.length, labels, values });
        this.salesEmpty = data.length === 0;
        if (this.salesEmpty) {
          if (this.salesChart) { this.salesChart.destroy(); this.salesChart = undefined; }
          return;
        }
        if (this.salesChart) this.salesChart.destroy();
        const ctx = this.salesChartCanvas?.nativeElement?.getContext('2d');
        if (!ctx) { console.warn('[AdminDashboard] Missing 2D context for sales chart'); return; }
        this.salesChart = new Chart(ctx, {
          type: 'line',
          data: { labels, datasets: [{ label: 'Sales', data: values, borderColor: '#4f46e5' }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: { x: { ticks: { autoSkip: true } }, y: { beginAtZero: true } }
          }
        });
        console.log('[AdminDashboard] Sales chart created');
      },
      error: (err) => {
        console.error('[AdminDashboard] Sales trends fetch error:', err);
      }
    });

    this.analyticsService.getTopProducts(start, end).subscribe({
      next: (data) => {
        this.topProducts = data;
        const labels = data.map(d => d.name);
        const values = data.map(d => d.quantity);
        console.log('[AdminDashboard] Top products data:', { count: data.length, labels, values });
        this.productsEmpty = data.length === 0;
        if (this.productsEmpty) {
          if (this.productsChart) { this.productsChart.destroy(); this.productsChart = undefined; }
          return;
        }
        if (this.productsChart) this.productsChart.destroy();
        const ctx = this.productsChartCanvas?.nativeElement?.getContext('2d');
        if (!ctx) { console.warn('[AdminDashboard] Missing 2D context for products chart'); return; }
        this.productsChart = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Top Products', data: values, backgroundColor: '#10b981' }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: { x: { ticks: { autoSkip: true } }, y: { beginAtZero: true } }
          }
        });
        console.log('[AdminDashboard] Products chart created');
      },
      error: (err) => {
        console.error('[AdminDashboard] Top products fetch error:', err);
      }
    });

    this.analyticsService.getAverageOrderValue(start, end).subscribe(v => (this.aov = v));
    this.analyticsService.getOnTimePercentage(start, end).subscribe(v => (this.onTime = v));
    this.analyticsService.getCancellationRate(start, end).subscribe(v => (this.cancellations = v));
  }

  private loadStats(): void {
    this.adminService.getDashboardStats().subscribe(stats => {
      this.totalOrders = stats.totalOrders || 0;
      this.totalRevenue = stats.totalRevenue || 0;
      this.pendingOrders = stats.pendingOrders || 0;
    });
  }
}

