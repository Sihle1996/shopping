import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { AdminService } from 'src/app/services/admin.service';
import { AdminAiService, DriverRecommendation } from 'src/app/services/admin-ai.service';
import { NotificationService } from 'src/app/services/notification.service';
import { ConfirmService } from 'src/app/shared/services/confirm.service';
import { TabItem } from 'src/app/shared/components/tabbed-list/tabbed-list.component';
import { ToastrService } from 'ngx-toastr';

/** Strict status unions */
type Status = 'Pending' | 'Scheduled' | 'Preparing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
type StatusFilter = Status | 'All';

interface OrderItem {
  name: string;
  quantity: number;
  size?: string;
  price?: number;
  specialInstructions?: string;
}
interface Order {
  id: string;
  totalAmount: number;
  status: Status | string;   // API tolerance
  orderDate: string;         // ISO string
  scheduledDeliveryTime?: string | null; // ISO — set when the customer scheduled for later
  deliveryAddress: string;
  userEmail: string;
  paymentId?: string;
  orderNotes?: string;
  driverName?: string | null;
  deliveredBy?: string | null; // DRIVER_OTP | DRIVER | ADMIN_OVERRIDE
  cancellationReason?: string | null;
  paid?: boolean; // payment confirmed (PayFast ITN) — unpaid orders can't be advanced into fulfilment
  items: OrderItem[];
}
interface PageResp<T> {
  content: T[];
  totalPages: number;
}
interface StatusOption { value: StatusFilter; label: string; }

@Component({
  selector: 'app-admin-orders',
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  orders: Order[] = [];

  // UI state
  loading = false;
  errorMessage = '';
  selectedOrder: Order | null = null;

  // Driver assign
  availableDrivers: Array<{ id: string; email: string }> = [];
  selectedDriverId: string | null = null;
  assigning = false;
  reassigning = false; // an already-assigned order reveals the picker only on explicit "Reassign"

  // Driver recommendations (deterministic assist layer; falls back to the plain list on failure)
  recommendations: DriverRecommendation[] = [];
  recsLoading = false;
  recsFailed = false;
  recsNote = '';
  recsReadinessNote = '';

  // Activity trail (audit) for the open order
  auditEvents: Array<{ source: string; action: string; summary: string; actor?: string; createdAt: string }> = [];

  // Filters / search / sort / paging
  statuses: ReadonlyArray<StatusOption> = [
    { value: 'All',              label: 'All' },
    { value: 'Pending',          label: 'Pending' },
    { value: 'Scheduled',        label: 'Scheduled' },
    { value: 'Preparing',        label: 'Preparing' },
    { value: 'Out for Delivery', label: 'Out for Delivery' },
    { value: 'Delivered',        label: 'Delivered' },
    { value: 'Cancelled',        label: 'Cancelled' },
  ] as const;

  /** Shared <app-tabbed-list> model (no counts — orders are server-paginated). */
  statusTabs: TabItem[] = this.statuses.map(s => ({ key: s.value, label: s.label }));

  orderStatuses: Status[] = ['Pending', 'Scheduled', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

  filterStatus: StatusFilter = 'All';

  searchTerm = '';
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  sortBy: keyof Order = 'orderDate';
  sortDirection: 'asc' | 'desc' = 'desc';

  currentPage = 1;
  pageSize = 5;
  totalPages = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private adminSerivce: AdminService,
    private adminAiService: AdminAiService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService,
    private notificationService: NotificationService,
    private confirm: ConfirmService
  ) {}

  ngOnInit(): void {
    this.fetchOrders(1);
    this.notificationService.acknowledgeOrders();   // viewing Orders stops the repeating new-order chime

    this.searchSub = this.searchSubject
      .pipe(debounceTime(300))
      .subscribe((q: string) => {
        this.searchTerm = q;
        this.fetchOrders(1);
      });

    // Real-time order events: instant local update, fetch only for new orders
    this.notificationService.orderEvents
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        if (event.type === 'ORDER_CREATED') {
          // New order — fetch page 1 so it appears at the top
          this.silentRefresh();
        } else if (event.type === 'ORDER_PAID' && event.orderId) {
          // PayFast ITN confirmed payment — flip the order to paid live, no manual refresh
          this.orders = this.orders.map(o =>
            o.id === event.orderId ? { ...o, paid: true } : o
          );
          if (this.selectedOrder?.id === event.orderId) {
            this.selectedOrder = { ...this.selectedOrder, paid: true };
          }
        } else if (event.orderId && event.status) {
          // Status/cancellation/assignment — update instantly, no HTTP call
          this.orders = this.orders.map(o =>
            o.id === event.orderId ? { ...o, status: event.status as any } : o
          );
          if (this.selectedOrder?.id === event.orderId) {
            this.selectedOrder = { ...this.selectedOrder, status: event.status as any };
          }
        }
      });
  }

  private get deepLinkOrderId(): string | null {
    return this.route.snapshot.queryParamMap.get('orderId');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSub?.unsubscribe();
  }

  /** Fetch current page without showing the loading skeleton */
  private silentRefresh(): void {
    this.adminSerivce.getOrders(this.currentPage - 1, this.pageSize, this.searchTerm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: PageResp<Order>) => {
          this.orders = res.content ?? [];
          this.totalPages = res.totalPages ?? 0;
        },
        error: () => {}
      });
  }

  // ──────────────────────────────────────────────────────────────────────────────
  fetchOrders(page: number = this.currentPage): void {
    this.loading = true;
    this.errorMessage = '';
    this.adminSerivce.getOrders(page - 1, this.pageSize, this.searchTerm)
      .subscribe({
        next: (res: PageResp<Order>) => {
          this.orders = res.content ?? [];
          this.totalPages = res.totalPages ?? 0;
          this.currentPage = page;
          this.loading = false;

          // Auto-open drawer if navigated from live orders feed
          const targetId = this.deepLinkOrderId;
          if (targetId) {
            const match = this.orders.find(o => o.id === targetId);
            if (match) {
              this.openDrawer(match);
            }
            // Clear the query param so a refresh doesn't re-open
            this.router.navigate([], { replaceUrl: true, queryParams: {} });
          }
        },
        error: () => {
          this.errorMessage = 'Failed to load orders.';
          this.loading = false;
        }
      });
  }

  onSearch(term: string): void {
    this.searchSubject.next(term);
  }

  setStatusFilter(v: StatusFilter): void {
    this.filterStatus = v;
    this.fetchOrders(1);
  }

  onPageChange(page: number): void {
    this.fetchOrders(page);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  setSort(col: keyof Order): void {
    if (this.sortBy === col) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDirection = 'asc';
    }
  }

  getSortIcon(col: keyof Order): string {
    if (this.sortBy !== col) return '↕';
    return this.sortDirection === 'asc' ? '▲' : '▼';
  }

  filteredOrders(): Order[] {
    const statusFiltered = this.filterStatus === 'All'
      ? this.orders.slice()
      : this.orders.filter(o => o.status === this.filterStatus);

    const q = (this.searchTerm ?? '').trim().toLowerCase();
    const searched = q
      ? statusFiltered.filter(o =>
          `${o.id}`.includes(q) ||
          (o.userEmail || '').toLowerCase().includes(q) ||
          (o.paymentId || '').toLowerCase().includes(q)
        )
      : statusFiltered;

    const col = this.sortBy;
    const dir = this.sortDirection === 'asc' ? 1 : -1;

    return searched.sort((a, b) => {
      let A: any = (a as any)[col];
      let B: any = (b as any)[col];
      if (col === 'orderDate') { A = new Date(a.orderDate).getTime(); B = new Date(b.orderDate).getTime(); }
      if (typeof A === 'string') A = A.toLowerCase();
      if (typeof B === 'string') B = B.toLowerCase();
      if (A < B) return -1 * dir;
      if (A > B) return  1 * dir;
      return 0;
    });
  }

  trackById = (_: number, o: Order) => o.id;

  // ──────────────────────────────────────────────────────────────────────────────
  /** Delivered/Cancelled/Rejected are final — no further status changes. */
  isTerminal(status?: string | null): boolean {
    return status === 'Delivered' || status === 'Cancelled' || status === 'Rejected';
  }

  /** Lifecycle state machine — mirrors the backend; no skipping straight to Delivered. */
  private statusFlow: Record<string, string[]> = {
    'Pending':          ['Preparing', 'Cancelled'],
    'Scheduled':        ['Preparing', 'Cancelled'],
    'Confirmed':        ['Preparing', 'Cancelled'],
    'Preparing':        ['Out for Delivery', 'Cancelled'],
    'Out for Delivery': ['Delivered', 'Cancelled'],
  };
  canMoveTo(from: string | undefined | null, to: string): boolean {
    return !!from && (this.statusFlow[from] ?? []).includes(to);
  }

  /** Block advancing an UNPAID order into fulfilment (mirrors the backend gate). Cancel/Reject stay
   *  allowed so the admin can clear an abandoned order. */
  isUnpaidBlock(order: Order | null | undefined, to: string): boolean {
    if (!order || order.paid !== false) return false;
    const advancing = ['Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'].includes(to);
    const reserved = order.status === 'Pending' || order.status === 'Scheduled';
    return advancing && reserved;
  }

  /** A driver may only be dispatched once the kitchen is on it (Preparing), or reassigned (OFD). */
  canAssignDriver(status?: string | null): boolean {
    return status === 'Preparing' || status === 'Out for Delivery';
  }

  /** Icon + colour for an activity-trail source (ADMIN/DRIVER/AI/SYSTEM). */
  auditSourceMeta(source: string): { icon: string; cls: string } {
    return ({
      ADMIN:  { icon: 'bi-person-fill', cls: 'bg-blue-100 text-blue-600' },
      DRIVER: { icon: 'bi-truck',       cls: 'bg-emerald-100 text-emerald-600' },
      AI:     { icon: 'bi-stars',       cls: 'bg-primary-100 text-primary' },
      SYSTEM: { icon: 'bi-gear-fill',   cls: 'bg-gray-100 text-gray-500' }
    } as any)[source] ?? { icon: 'bi-dot', cls: 'bg-gray-100 text-gray-500' };
  }

  /** Friendly label for a stored cancellation reason (markers map to text; free text passes through). */
  cancelReasonLabel(reason?: string | null): string {
    if (!reason) return '';
    return ({ AUTO_TIMEOUT: 'Auto-cancelled — not accepted in time', ADMIN_CANCELLED: 'Cancelled by the store' } as any)[reason] ?? reason;
  }

  /** How a delivered order was confirmed — for the audit-at-a-glance label. */
  deliveredByLabel(by?: string | null): string {
    return ({ DRIVER_OTP: 'OTP confirmed', DRIVER: 'driver confirmed', ADMIN_OVERRIDE: 'admin override' } as any)[by || ''] ?? '';
  }

  /** Button entry point — confirms outward/irreversible actions before applying them. */
  requestStatusChange(orderId: string, newStatus: Status): void {
    const order = this.selectedOrder?.id === orderId ? this.selectedOrder
                : this.orders.find(o => o.id === orderId) || null;
    if (!order || order.status === newStatus || this.isTerminal(order.status)
        || !this.canMoveTo(order.status, newStatus)) return;
    if (this.isUnpaidBlock(order, newStatus)) {
      this.toastr.warning("This order hasn't been paid yet — wait for payment confirmation.");
      return;
    }

    if (newStatus === 'Delivered') {
      if (!order.driverName) { this.toastr.warning('Assign a driver before marking this order delivered.'); return; }
      this.confirm.ask({
        title: 'Mark as delivered?',
        message: 'This emails the customer that their order was delivered and finalises the sale. It can\'t be undone.',
        confirmLabel: 'Mark delivered', variant: 'warning'
      }).subscribe(ok => { if (ok) this.updateStatus(orderId, newStatus); });
      return;
    }
    if (newStatus === 'Cancelled') {
      this.confirm.ask({
        title: 'Cancel this order?',
        message: 'This notifies the customer, releases the reserved stock, and can\'t be undone.',
        confirmLabel: 'Cancel order', variant: 'danger',
        input: { placeholder: 'Reason (saved on the order) — e.g. out of stock, customer request' }
      }).subscribe(ok => { if (ok) this.updateStatus(orderId, newStatus, this.confirm.lastValue); });
      return;
    }
    this.updateStatus(orderId, newStatus);
  }

  updateStatus(orderId: string, newStatus: Status, reason?: string): void {
    const order = this.selectedOrder?.id === orderId ? this.selectedOrder
                : this.orders.find(o => o.id === orderId) || null;
    // Block no-ops, terminal orders, and any non-adjacent (skip/backward) transition.
    if (order && (order.status === newStatus || this.isTerminal(order.status)
        || !this.canMoveTo(order.status, newStatus))) return;
    // Optimistic UI — toastr feedback handled by OptimisticService
    this.orders = this.orders.map(o => (o.id === orderId ? { ...o, status: newStatus } : o));
    if (this.selectedOrder?.id === orderId) this.selectedOrder = { ...this.selectedOrder, status: newStatus };
    this.adminSerivce.updateOrderStatus(orderId, newStatus, reason);
  }

  /** A one-click <app-order-actions> change committed — mirror it into the local list optimistically
   *  (the websocket ORDER_UPDATED reconciles, and the shared service handles the backend + revert). */
  onOrderChanged(e: { id: string; status: string }): void {
    this.orders = this.orders.map(o => (o.id === e.id ? { ...o, status: e.status as Status } : o));
    if (this.selectedOrder?.id === e.id) this.selectedOrder = { ...this.selectedOrder, status: e.status as Status };
  }

  openDrawer(order: Order): void {
    this.selectedOrder = order;
    this.selectedDriverId = null;
    this.reassigning = false;
    this.auditEvents = [];
    this.adminSerivce.getOrderAudit(order.id).subscribe({ next: e => this.auditEvents = e ?? [], error: () => {} });
    // Plain list — stays the override + the fallback if recommendations fail.
    this.adminSerivce.getAvailableDrivers().subscribe({
      next: (drivers: Array<{ id: string; email: string }>) => (this.availableDrivers = drivers ?? []),
      error: () => {}
    });
    // Assist layer — ranked, explained suggestions. Never auto-selects a driver.
    this.recommendations = [];
    this.recsFailed = false;
    this.recsNote = '';
    this.recsReadinessNote = '';
    this.recsLoading = true;
    this.adminAiService.driverRecommendations(order.id).subscribe({
      next: (res) => {
        this.recommendations = res?.drivers ?? [];
        this.recsNote = res?.note ?? '';
        this.recsReadinessNote = res?.readinessNote ?? '';
        this.recsLoading = false;
      },
      error: () => { this.recsFailed = true; this.recsLoading = false; } // plain dropdown still works
    });
  }

  /** Admin picks a suggested driver — only sets the selection; assignment is still a manual click. */
  selectRecommended(d: DriverRecommendation): void {
    if (!d.available) return;
    this.selectedDriverId = d.driverId;
  }

  confidenceLabel(c: string): string {
    return ({ HIGH: 'High confidence', MEDIUM: 'Medium', LOW: 'Low confidence' } as any)[c] ?? c;
  }

  confidenceClass(c: string): string {
    return ({
      HIGH: 'bg-emerald-100 text-emerald-700',
      MEDIUM: 'bg-amber-100 text-amber-700',
      LOW: 'bg-gray-100 text-gray-600'
    } as any)[c] ?? 'bg-gray-100 text-gray-600';
  }

  /** Location freshness badge — colours read faster than a confidence label. */
  locationBadge(d: DriverRecommendation): { label: string; cls: string; dot: string } {
    const m = d.locationAgeMinutes;
    if (m == null) return { label: 'No location', cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' };
    if (m <= 5)    return { label: 'Live',         cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' };
    if (m <= 30)   return { label: m + 'm ago',    cls: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500' };
    return { label: m + 'm ago', cls: 'bg-red-50 text-red-700', dot: 'bg-red-500' };
  }

  closeDrawer(): void {
    this.selectedOrder = null;
    this.selectedDriverId = null;
  }

  assignDriver(): void {
    if (!this.selectedOrder || !this.selectedDriverId) return;
    this.assigning = true;

    const rec = this.recommendations.find(r => r.recommended); // what the engine suggested
    this.adminSerivce.assignDriver(this.selectedOrder.id, this.selectedDriverId, rec?.driverId, rec?.score).subscribe({
      next: (updated: Order | void) => {
        if (updated) {
          this.selectedOrder = updated;
          this.orders = this.orders.map(o => (o.id === (updated as Order).id ? updated as Order : o));
        } else {
          this.orders = this.orders.map(o =>
            o.id === this.selectedOrder!.id ? { ...o, status: 'In Progress' } : o
          );
        }
        this.assigning = false;
        this.reassigning = false;
        this.selectedDriverId = null;
        this.toastr.success('Driver assigned successfully');
      },
      error: () => {
        this.assigning = false;
        this.toastr.error('Failed to assign driver');
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────────
  getStatusIndex(status: string): number {
    return this.orderStatuses.indexOf(status as Status);
  }

  /** Cancelled/Rejected are terminal off-ramps, not a step on the fulfilment bar. */
  isTerminalCancel(status: string): boolean {
    return status === 'Cancelled' || status === 'Rejected';
  }

  /** The actual fulfilment path for THIS order — 'Scheduled' only appears if it was scheduled. */
  progressSteps(order: any): string[] {
    const wasScheduled = order?.status === 'Scheduled' || !!order?.scheduledDeliveryTime;
    return wasScheduled
      ? ['Pending', 'Scheduled', 'Preparing', 'Out for Delivery', 'Delivered']
      : ['Pending', 'Preparing', 'Out for Delivery', 'Delivered'];
  }

  progressIndex(order: any): number {
    return this.progressSteps(order).indexOf(order?.status);
  }

  statusChip(s: string) {
    return {
      'bg-amber-100 text-amber-800': s === 'Pending',
      'bg-indigo-100 text-indigo-800': s === 'Scheduled',
      'bg-blue-100 text-blue-800': s === 'Preparing',
      'bg-purple-100 text-purple-800': s === 'Out for Delivery',
      'bg-emerald-100 text-emerald-800': s === 'Delivered',
      'bg-red-100 text-red-600': s === 'Cancelled',
    };
  }
  statusDot(s: string) {
    return {
      'bg-amber-500': s === 'Pending',
      'bg-indigo-500': s === 'Scheduled',
      'bg-blue-500': s === 'Preparing',
      'bg-purple-500': s === 'Out for Delivery',
      'bg-emerald-500': s === 'Delivered',
      'bg-red-500': s === 'Cancelled',
    };
  }

  /** Status-coloured left accent so operators scan an order's state at a glance down the table. */
  statusAccent(s: string) {
    return {
      'border-l-amber-400': s === 'Pending',
      'border-l-indigo-400': s === 'Scheduled',
      'border-l-blue-400': s === 'Preparing',
      'border-l-purple-400': s === 'Out for Delivery',
      'border-l-emerald-400': s === 'Delivered',
      'border-l-red-400': s === 'Cancelled' || s === 'Rejected',
    };
  }

  /** KPIs for the header cards (based on filtered list) */
  get kpi() {
    const list = this.filteredOrders();
    const pending = list.filter(o => o.status === 'Pending').length;
    const preparing = list.filter(o => o.status === 'Preparing').length;
    const outForDelivery = list.filter(o => o.status === 'Out for Delivery').length;
    const revenue = list.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return { pending, preparing, outForDelivery, revenue };
  }
}
