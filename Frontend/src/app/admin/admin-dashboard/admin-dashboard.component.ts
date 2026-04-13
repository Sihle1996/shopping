import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexDataLabels, ApexTooltip, ApexFill, ApexStroke,
  ApexPlotOptions, ApexGrid, ApexNoData
} from 'ng-apexcharts';
import { driver } from 'driver.js';
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

  // All-time stats
  totalOrders = 0;
  totalRevenue = 0;
  pendingOrders = 0;

  // Today's stats
  todayOrders = 0;
  todayRevenue = 0;

  // Analytics (PRO/ENTERPRISE)
  aov = 0;
  onTime = 0;
  cancellations = 0;
  topProducts: any[] = [];

  // Store toggle
  isStoreOpen = false;
  toggleLoading = false;

  // Recent orders (live feed)
  recentOrders: any[] = [];
  recentOrdersLoading = true;

  hasAnalytics = false;
  hasCustomBranding = false;
  subscriptionPlan = '';
  statsLoading = true;
  analyticsLoading = true;
  settingsLoading = true;

  // Onboarding checklist
  setupMenuItems: any[] = [];
  setupCategories: any[] = [];
  setupDrivers: any[] = [];
  setupSettings: any = null;
  onboardingDismissed = localStorage.getItem(`onboardingDone_${localStorage.getItem('tenantId') || ''}`) === 'true';

  private get onboardingKey(): string {
    return `onboardingDone_${localStorage.getItem('tenantId') || ''}`;
  }

  salesChartOptions: Partial<SalesChartOptions> = this.buildSalesChartOptions([], []);
  productsChartOptions: Partial<ProductsChartOptions> = this.buildProductsChartOptions([], []);

  constructor(
    private analyticsService: AnalyticsService,
    private adminService: AdminService,
    private subscriptionService: SubscriptionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    this.startDate = start.toISOString().substring(0, 10);
    this.endDate = now.toISOString().substring(0, 10);

    this.loadStats();
    this.loadStoreSettings();
    this.loadRecentOrders();
    this.adminService.menuItems$.subscribe(items => this.setupMenuItems = items);
    this.adminService.loadMenuItems().subscribe({ error: () => {} });
    this.adminService.getCategories().subscribe({ next: cats => this.setupCategories = cats, error: () => {} });
    this.adminService.getDrivers().subscribe({ next: d => this.setupDrivers = d, error: () => {} });

    this.subscriptionService.load().subscribe(info => {
      this.hasAnalytics = info.features.hasAnalytics;
      this.hasCustomBranding = info.features.hasCustomBranding;
      this.subscriptionPlan = info.plan;
      if (this.hasAnalytics) this.loadAnalytics();
      else this.analyticsLoading = false;
    });
  }

  private loadStoreSettings(): void {
    this.adminService.getStoreSettings().subscribe({
      next: settings => {
        this.isStoreOpen = settings.isOpen ?? false;
        this.setupSettings = settings;
        this.settingsLoading = false;
        this.maybeAutoSpotlight();
      },
      error: () => { this.settingsLoading = false; }
    });
  }

  // ── Onboarding checklist ──────────────────────────────────────────────────

  get setupSteps() {
    const s = this.setupSettings;
    return [
      { label: 'Add your store info',      done: !!(s?.phone),                    route: '/admin/settings', tourParam: 'store-info',   actionLabel: 'Set up',     proLocked: false },
      { label: 'Upload a logo',            done: !!(s?.logoUrl),                   route: '/admin/settings', tourParam: 'logo',         actionLabel: 'Set up',     proLocked: !this.hasCustomBranding },
      { label: 'Set delivery fee',         done: (s?.deliveryFeeBase ?? 0) > 0,    route: '/admin/settings', tourParam: 'delivery',     actionLabel: 'Set up',     proLocked: false },
      { label: 'Add a menu category',      done: this.setupCategories.length > 0,  route: '/admin/settings', tourParam: 'category',     actionLabel: 'Set up',     proLocked: false },
      { label: 'Add your first menu item', done: this.setupMenuItems.length > 0,   route: '/admin/menu',     tourParam: 'add-item',     actionLabel: 'Add item',   proLocked: false },
      { label: 'Add a delivery driver',    done: this.setupDrivers.length > 0,     route: '/admin/drivers',  tourParam: 'add-driver',   actionLabel: 'Add driver', proLocked: false },
      { label: 'Open your store',          done: !!(s?.isOpen),                    route: null,              tourParam: 'store-toggle', actionLabel: 'Open now',   proLocked: false },
    ];
  }

  get setupDoneCount() { return this.setupSteps.filter(s => s.done).length; }
  get setupProgress()  { return Math.round((this.setupDoneCount / this.setupSteps.length) * 100); }
  get setupComplete()  { return this.setupDoneCount === this.setupSteps.length; }
  get showOnboarding() { return !this.onboardingDismissed; }

  dismissOnboarding(): void {
    this.onboardingDismissed = true;
    localStorage.setItem(this.onboardingKey, 'true');
  }

  goToStep(step: any): void {
    if (step.proLocked) {
      this.router.navigate(['/admin/subscription']);
      return;
    }
    if (step.tourParam === 'store-toggle') {
      this.spotlightElement('store-toggle-btn', 'Open Your Store', 'Toggle this switch to start accepting orders from customers');
      return;
    }
    this.router.navigate([step.route], { queryParams: { tour: step.tourParam } });
  }

  private spotlightElement(elementId: string, title: string, description: string): void {
    const d = driver({ animate: true, overlayOpacity: 0.35 });
    d.highlight({ element: '#' + elementId, popover: { title, description, side: 'bottom', align: 'start' } });
  }

  private maybeAutoSpotlight(): void {
    if (this.onboardingDismissed || this.setupComplete) return;
    // Spotlight the checklist card on first visit so new owners notice it
    setTimeout(() => this.spotlightElement('onboarding-card', 'Welcome! Let\'s get you set up', 'Follow these steps to go live in minutes. Click each step to be guided directly to the right place.'), 800);
  }

  private loadRecentOrders(): void {
    this.recentOrdersLoading = true;
    this.adminService.getRecentOrders().subscribe({
      next: orders => { this.recentOrders = orders; this.recentOrdersLoading = false; },
      error: () => { this.recentOrdersLoading = false; }
    });
  }

  toggleStore(): void {
    this.toggleLoading = true;
    this.adminService.toggleStoreOpen().subscribe({
      next: res => { this.isStoreOpen = res.isOpen; this.toggleLoading = false; },
      error: () => { this.toggleLoading = false; }
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
      this.todayOrders = stats.todayOrders || 0;
      this.todayRevenue = stats.todayRevenue || 0;
      this.statsLoading = false;
    });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Pending':          return 'bg-yellow-100 text-yellow-700';
      case 'Confirmed':        return 'bg-blue-100 text-blue-700';
      case 'Preparing':        return 'bg-orange-100 text-orange-700';
      case 'Out for Delivery': return 'bg-purple-100 text-purple-700';
      case 'Delivered':        return 'bg-green-100 text-green-700';
      case 'Cancelled':        return 'bg-red-100 text-red-500';
      case 'Rejected':         return 'bg-gray-100 text-gray-500';
      default:                 return 'bg-gray-100 text-gray-600';
    }
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'Pending':          return 'bi-clock';
      case 'Confirmed':        return 'bi-check';
      case 'Preparing':        return 'bi-fire';
      case 'Out for Delivery': return 'bi-truck';
      case 'Delivered':        return 'bi-check-circle-fill';
      case 'Cancelled':        return 'bi-x-circle';
      case 'Rejected':         return 'bi-slash-circle';
      default:                 return 'bi-circle';
    }
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
