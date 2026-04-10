import { Component, OnInit } from '@angular/core';
import {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexDataLabels, ApexTooltip, ApexFill, ApexStroke,
  ApexPlotOptions, ApexGrid, ApexNoData
} from 'ng-apexcharts';
import { AnalyticsService } from './analytics.service';
import { AdminService } from 'src/app/services/admin.service';
import { SubscriptionService } from 'src/app/services/subscription.service';

export type SalesChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  fill: ApexFill;
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  grid: ApexGrid;
  noData: ApexNoData;
};

export type ProductsChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  grid: ApexGrid;
  noData: ApexNoData;
  colors: string[];
};

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  startDate!: string;
  endDate!: string;

  totalOrders = 0;
  totalRevenue = 0;
  pendingOrders = 0;
  aov = 0;
  onTime = 0;
  cancellations = 0;
  topProducts: any[] = [];

  hasAnalytics = false;
  subscriptionPlan = '';
  statsLoading = true;
  analyticsLoading = true;

  salesChartOptions: Partial<SalesChartOptions> = this.buildSalesChartOptions([], []);
  productsChartOptions: Partial<ProductsChartOptions> = this.buildProductsChartOptions([], []);

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
      if (this.hasAnalytics) this.loadAnalytics();
      else this.analyticsLoading = false;
    });
  }

  loadAnalytics(): void {
    this.analyticsLoading = true;
    const { startDate: start, endDate: end } = this;

    this.analyticsService.getSalesTrends(start, end).subscribe({
      next: data => {
        this.salesChartOptions = this.buildSalesChartOptions(
          data.map(d => d.date),
          data.map(d => d.total)
        );
      },
      error: () => { this.analyticsLoading = false; }
    });

    this.analyticsService.getTopProducts(start, end).subscribe({
      next: data => {
        this.topProducts = data;
        this.productsChartOptions = this.buildProductsChartOptions(
          data.map(d => d.name),
          data.map(d => d.quantity)
        );
        this.analyticsLoading = false;
      },
      error: () => { this.analyticsLoading = false; }
    });

    this.analyticsService.getAverageOrderValue(start, end).subscribe(v => this.aov = v);
    this.analyticsService.getOnTimePercentage(start, end).subscribe(v => this.onTime = v);
    this.analyticsService.getCancellationRate(start, end).subscribe(v => this.cancellations = v);
  }

  private loadStats(): void {
    this.statsLoading = true;
    this.adminService.getDashboardStats().subscribe(stats => {
      this.totalOrders = stats.totalOrders || 0;
      this.totalRevenue = stats.totalRevenue || 0;
      this.pendingOrders = stats.pendingOrders || 0;
      this.statsLoading = false;
    });
  }

  private buildSalesChartOptions(labels: string[], values: number[]): Partial<SalesChartOptions> {
    return {
      series: [{ name: 'Revenue', data: values }],
      chart: { type: 'area', height: 280, toolbar: { show: false }, sparkline: { enabled: false } },
      xaxis: { categories: labels, labels: { style: { fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { formatter: (v: number) => `R${v.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`, style: { fontSize: '11px' } } },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05, stops: [0, 100] } },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (v: number) => `R${v.toFixed(2)}` } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      noData: { text: 'No sales data for this period', style: { color: '#94a3b8' } }
    };
  }

  private buildProductsChartOptions(labels: string[], values: number[]): Partial<ProductsChartOptions> {
    return {
      series: [{ name: 'Orders', data: values }],
      chart: { type: 'bar', height: 280, toolbar: { show: false } },
      plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%' } },
      xaxis: { categories: labels, labels: { style: { fontSize: '11px' } } },
      yaxis: { labels: { style: { fontSize: '11px' } } },
      dataLabels: { enabled: true, style: { fontSize: '11px' } },
      tooltip: { y: { formatter: (v: number) => `${v} orders` } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      noData: { text: 'No product data for this period', style: { color: '#94a3b8' } },
      colors: ['#10b981']
    };
  }
}
