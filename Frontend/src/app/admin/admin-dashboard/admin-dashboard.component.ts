import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import confetti from 'canvas-confetti';
import {
  ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis,
  ApexDataLabels, ApexTooltip, ApexFill, ApexStroke,
  ApexPlotOptions, ApexGrid, ApexNoData
} from 'ng-apexcharts';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { driver } from 'driver.js';
import { AnalyticsService } from './analytics.service';
import { AdminService } from 'src/app/services/admin.service';
import { AdminAiService } from 'src/app/services/admin-ai.service';
import { SubscriptionService } from 'src/app/services/subscription.service';
import { NotificationService } from 'src/app/services/notification.service';
import { ToastrService } from 'ngx-toastr';

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
  colors: string[];
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

interface SetupStep {
  label: string;
  done: boolean;
  route: string | null;
  tourParam: string;
  actionLabel: string;
  proLocked: boolean;
  prereqLocked: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
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
  avgDeliveryMinutes = 0;
  topProducts: any[] = [];
  peakHoursChartOptions: Partial<ProductsChartOptions> = this.buildPeakHoursChartOptions([]);

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

  // AI Chat widget
  chatOpen = false;
  chatInput = '';
  chatMessages: Array<{ role: 'user' | 'ai'; text: string }> = [];
  chatLoading = false;

  // Onboarding checklist
  setupMenuItems: any[] = [];
  setupCategories: any[] = [];
  setupDrivers: any[] = [];
  setupSettings: any = null;
  onboardingDismissed = localStorage.getItem(`onboardingDone_${localStorage.getItem('tenantId') || ''}`) === 'true';
  cardJustArrived = false;
  private activeDriver: any = null;

  private get onboardingKey(): string {
    return `onboardingDone_${localStorage.getItem('tenantId') || ''}`;
  }

  private get confettiKey(): string {
    return `confettiFired_${localStorage.getItem('tenantId') || ''}`;
  }

  salesChartOptions: Partial<SalesChartOptions> = this.buildSalesChartOptions([], []);
  productsChartOptions: Partial<ProductsChartOptions> = this.buildProductsChartOptions([], []);

  private destroy$ = new Subject<void>();

  constructor(
    private analyticsService: AnalyticsService,
    private adminService: AdminService,
    private adminAiService: AdminAiService,
    private subscriptionService: SubscriptionService,
    private notificationService: NotificationService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    this.startDate = start.toISOString().substring(0, 10);
    this.endDate = now.toISOString().substring(0, 10);

    this.loadStats();
    this.loadStoreSettings();
    this.loadRecentOrders();

    this.notificationService.orderEvents
      .pipe(debounceTime(200), takeUntil(this.destroy$))
      .subscribe(() => this.silentRefresh());
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

  /** Computed directly from raw data — no dependency on setupSteps to avoid circular inference */
  get canOpenStore(): boolean {
    const s = this.setupSettings;
    const storeInfoDone = !!(s?.phone);
    const deliveryDone  = (s?.deliveryFeeBase ?? 0) > 0;
    const categoryDone  = this.setupCategories.length > 0;
    const menuItemDone  = this.setupMenuItems.length > 0;
    return storeInfoDone && deliveryDone && categoryDone && menuItemDone;
  }

  get setupSteps(): SetupStep[] {
    const s = this.setupSettings;
    return [
      { label: 'Add your store info',      done: !!(s?.phone),                   route: '/admin/settings', tourParam: 'store-info',   actionLabel: 'Set up',   proLocked: false, prereqLocked: false },
      { label: 'Set delivery fee',         done: (s?.deliveryFeeBase ?? 0) > 0,  route: '/admin/settings', tourParam: 'delivery',     actionLabel: 'Set up',   proLocked: false, prereqLocked: false },
      { label: 'Add a menu category',      done: this.setupCategories.length > 0, route: '/admin/settings', tourParam: 'category',    actionLabel: 'Set up',   proLocked: false, prereqLocked: false },
      { label: 'Add your first menu item', done: this.setupMenuItems.length > 0,  route: '/admin/menu',     tourParam: 'add-item',    actionLabel: 'Add item', proLocked: false, prereqLocked: false },
      { label: 'Open your store',          done: !!(s?.isOpen),                   route: null,              tourParam: 'store-toggle', actionLabel: 'Open now', proLocked: false, prereqLocked: !this.canOpenStore },
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
    this.destroyDriver();
    if (step.proLocked) {
      this.router.navigate(['/admin/subscription']);
      return;
    }
    if (step.prereqLocked) return; // not yet unlocked — ignore click
    if (step.tourParam === 'store-toggle') {
      setTimeout(() => this.spotlightElement('store-toggle-btn', 'Open Your Store', 'Toggle this switch to start accepting orders from customers'), 50);
      return;
    }
    this.router.navigate([step.route], { queryParams: { tour: step.tourParam } });
  }

  private destroyDriver(): void {
    try { this.activeDriver?.destroy(); } catch { /* ignore */ }
    this.activeDriver = null;
  }

  private spotlightElement(elementId: string, title: string, description: string): void {
    this.destroyDriver();
    const el = document.getElementById(elementId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const d = driver({
      animate: true,
      overlayOpacity: 0.4,
      allowClose: true,
      overlayClickBehavior: 'close',
      onDestroyed: () => { this.activeDriver = null; }
    });
    this.activeDriver = d;
    setTimeout(() => {
      d.highlight({ element: '#' + elementId, popover: { title, description, side: 'bottom', align: 'start', showButtons: ['close'] } });
    }, 350);
  }

  private maybeAutoSpotlight(): void {
    if (this.onboardingDismissed || this.setupComplete) return;
    setTimeout(() => {
      const el = document.getElementById('onboarding-card');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.cardJustArrived = true;
      setTimeout(() => this.cardJustArrived = false, 3000);
    }, 600);
  }

  private fireConfetti(): void {
    const colors = ['#E76F51', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#ffffff'];
    const end = Date.now() + 3500;
    const burst = () => {
      confetti({ particleCount: 4, angle: 60,  spread: 60, origin: { x: 0, y: 0.8 }, colors, zIndex: 9999 });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors, zIndex: 9999 });
      if (Date.now() < end) requestAnimationFrame(burst);
    };
    // Opening burst
    confetti({ particleCount: 80, spread: 100, origin: { y: 0.55 }, colors, zIndex: 9999 });
    setTimeout(burst, 200);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyDriver();
  }

  private silentRefresh(): void {
    this.adminService.getDashboardStats().pipe(takeUntil(this.destroy$)).subscribe({
      next: stats => {
        this.totalOrders = stats.totalOrders || 0;
        this.totalRevenue = stats.totalRevenue || 0;
        this.pendingOrders = stats.pendingOrders || 0;
        this.todayOrders = stats.todayOrders || 0;
        this.todayRevenue = stats.todayRevenue || 0;
      },
      error: () => {}
    });
    this.adminService.getRecentOrders().pipe(takeUntil(this.destroy$)).subscribe({
      next: orders => { this.recentOrders = orders; },
      error: () => {}
    });
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
      next: res => {
        this.isStoreOpen = res.isOpen;
        if (this.setupSettings) this.setupSettings.isOpen = res.isOpen;
        this.toggleLoading = false;
        this.toastr.success(res.isOpen ? 'Store is now open' : 'Store is now closed');
        if (res.isOpen) {
          if (!localStorage.getItem(this.confettiKey)) {
            localStorage.setItem(this.confettiKey, 'true');
            this.fireConfetti();
          }
          if (this.setupComplete) this.dismissOnboarding();
        }
      },
      error: () => {
        this.toggleLoading = false;
        this.toastr.error('Failed to update store status');
      }
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
    this.analyticsService.getDeliveryTime(start, end).subscribe(v => this.avgDeliveryMinutes = v);
    this.analyticsService.getPeakHours(start, end).subscribe(data => {
      this.peakHoursChartOptions = this.buildPeakHoursChartOptions(data);
    });
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

  private getBrandColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim() || '#E76F51';
  }

  private buildSalesChartOptions(labels: string[], values: number[]): Partial<SalesChartOptions> {
    const color = this.getBrandColor();
    return {
      series: [{ name: 'Revenue', data: values }],
      chart: { type: 'area', height: 280, toolbar: { show: false }, sparkline: { enabled: false } },
      colors: [color],
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

  // ── AI Chat ─────────────────────────────────────────────────────────────

  toggleChat(): void {
    this.chatOpen = !this.chatOpen;
  }

  sendChatMessage(): void {
    const q = this.chatInput.trim();
    if (!q || this.chatLoading) return;
    this.chatMessages.push({ role: 'user', text: q });
    this.chatInput = '';
    this.chatLoading = true;
    this.adminAiService.query(q).subscribe({
      next: (res) => {
        this.chatLoading = false;
        this.chatMessages.push({ role: 'ai', text: res.answer });
      },
      error: () => {
        this.chatLoading = false;
        this.chatMessages.push({ role: 'ai', text: 'Sorry, I could not process that. Please try again.' });
      }
    });
  }

  onChatKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChatMessage();
    }
  }

  private buildPeakHoursChartOptions(data: Array<{ hour: number; orderCount: number }>): Partial<ProductsChartOptions> {
    const color = this.getBrandColor();
    const labels = data.map(d => `${d.hour}:00`);
    const values = data.map(d => d.orderCount);
    return {
      series: [{ name: 'Orders', data: values }],
      chart: { type: 'bar', height: 240, toolbar: { show: false } },
      colors: [color],
      plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
      xaxis: { categories: labels, labels: { style: { fontSize: '10px' } } },
      yaxis: { labels: { style: { fontSize: '11px' } } },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (v: number) => `${v} orders` } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      noData: { text: 'No order data for this period', style: { color: '#94a3b8' } }
    };
  }

  private buildProductsChartOptions(labels: string[], values: number[]): Partial<ProductsChartOptions> {
    const color = this.getBrandColor();
    return {
      series: [{ name: 'Orders', data: values }],
      chart: { type: 'bar', height: 280, toolbar: { show: false } },
      colors: [color],
      plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '60%' } },
      xaxis: { categories: labels, labels: { style: { fontSize: '11px' } } },
      yaxis: { labels: { style: { fontSize: '11px' } } },
      dataLabels: { enabled: true, style: { fontSize: '11px' } },
      tooltip: { y: { formatter: (v: number) => `${v} orders` } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      noData: { text: 'No product data for this period', style: { color: '#94a3b8' } }
    };
  }
}
