import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { AnalyticsService } from './analytics.service';
import { AdminService } from 'src/app/services/admin.service';
import { SubscriptionService } from 'src/app/services/subscription.service';

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
  salesError = false;
  productsError = false;
  topProducts: any[] = [];
  aov = 0;
  onTime = 0;
  cancellations = 0;
  totalOrders = 0;
  totalRevenue = 0;
  pendingOrders = 0;

  hasAnalytics = false;
  subscriptionPlan = '';

  constructor(
    private analyticsService: AnalyticsService,
    private adminService: AdminService,
    private subscriptionService: SubscriptionService
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    this.startDate = start.toISOString().substring(0, 10);
    this.endDate = now.toISOString().substring(0, 10);
    this.loadStats();

    this.subscriptionService.load().subscribe(info => {
      this.hasAnalytics = info.features.hasAnalytics;
      this.subscriptionPlan = info.plan;
      // Charts canvases are ready by the time the HTTP response arrives,
      // so trigger analytics load here instead of ngAfterViewInit.
      this.loadAnalytics();
    });
  }

  ngAfterViewInit(): void {
    // intentionally empty — analytics are loaded once subscription info arrives
  }

  loadAnalytics(): void {
    if (!this.hasAnalytics) return;

    const start = this.startDate;
    const end = this.endDate;

    this.salesError = false;
    this.analyticsService.getSalesTrends(start, end).subscribe({
      next: (data) => {
        this.salesEmpty = data.length === 0;
        const labels = data.map(d => d.date);
        const values = data.map(d => d.total);
        if (this.salesChart) {
          this.salesChart.data.labels = labels;
          this.salesChart.data.datasets[0].data = values;
          this.salesChart.update();
        } else {
          const ctx = this.salesChartCanvas?.nativeElement?.getContext('2d');
          if (!ctx) return;
          this.salesChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Sales', data: values, borderColor: '#4f46e5', tension: 0.3, fill: false }] },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: true } },
              scales: { x: { ticks: { autoSkip: true } }, y: { beginAtZero: true } }
            }
          });
        }
      },
      error: () => { this.salesError = true; this.salesEmpty = true; }
    });

    this.productsError = false;
    this.analyticsService.getTopProducts(start, end).subscribe({
      next: (data) => {
        this.topProducts = data;
        this.productsEmpty = data.length === 0;
        const labels = data.map(d => d.name);
        const values = data.map(d => d.quantity);
        if (this.productsChart) {
          this.productsChart.data.labels = labels;
          this.productsChart.data.datasets[0].data = values;
          this.productsChart.update();
        } else {
          const ctx = this.productsChartCanvas?.nativeElement?.getContext('2d');
          if (!ctx) return;
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
        }
      },
      error: () => { this.productsError = true; this.productsEmpty = true; }
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
