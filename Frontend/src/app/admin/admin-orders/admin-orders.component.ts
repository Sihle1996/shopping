import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AdminService } from 'src/app/services/admin.service';

/** Strict status unions */
type Status = 'Pending' | 'In Progress' | 'Delivered';
type StatusFilter = Status | 'All';

interface OrderItem {
  name: string;
  quantity: number;
  size?: string;
  price?: number;
}
interface Order {
  id: number;
  totalAmount: number;
  status: Status | string;   // API tolerance
  orderDate: string;         // ISO string
  deliveryAddress: string;
  userEmail: string;
  paymentId?: string;
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
  availableDrivers: Array<{ id: number; email: string }> = [];
  selectedDriverId: number | null = null;
  assigning = false;

  // Filters / search / sort / paging
  statuses: ReadonlyArray<StatusOption> = [
    { value: 'All',         label: 'All' },
    { value: 'Pending',     label: 'Pending' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Delivered',   label: 'Delivered' },
  ] as const;

  filterStatus: StatusFilter = 'All';

  searchTerm = '';
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  sortBy: keyof Order = 'id';
  sortDirection: 'asc' | 'desc' = 'asc';

  currentPage = 1;
  pageSize = 5;
  totalPages = 0;

  constructor(private adminSerivce: AdminService) {}

  ngOnInit(): void {
    this.fetchOrders(1);

    this.searchSub = this.searchSubject
      .pipe(debounceTime(300))
      .subscribe((q: string) => {
        this.searchTerm = q;
        this.fetchOrders(1);
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
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
        },
        error: (err: unknown) => {
          console.error(err);
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
  updateStatus(orderId: number, newStatus: Status): void {
    // Optimistic UI
    this.orders = this.orders.map(o => (o.id === orderId ? { ...o, status: newStatus } : o));
    // Fire-and-forget: service returns void (handles optimistic/revert itself if needed)
    this.adminSerivce.updateOrderStatus(orderId, newStatus);
  }

  openDrawer(order: Order): void {
    this.selectedOrder = order;
    this.selectedDriverId = null;
    this.adminSerivce.getAvailableDrivers().subscribe({
      next: (drivers: Array<{ id: number; email: string }>) => (this.availableDrivers = drivers ?? []),
      error: (err: unknown) => console.error('Failed to load drivers', err)
    });
  }

  closeDrawer(): void {
    this.selectedOrder = null;
    this.selectedDriverId = null;
  }

  assignDriver(): void {
    if (!this.selectedOrder || !this.selectedDriverId) return;
    this.assigning = true;

    this.adminSerivce.assignDriver(this.selectedOrder.id, this.selectedDriverId).subscribe({
      next: (updated: Order | void) => {
        if (updated) {
          this.selectedOrder = updated;
          this.orders = this.orders.map(o => (o.id === updated.id ? updated : o));
        } else {
          // If API returns no body, reflect a sensible state
          this.orders = this.orders.map(o =>
            o.id === this.selectedOrder!.id ? { ...o, status: 'In Progress' } : o
          );
        }
        this.assigning = false;
      },
      error: (err: unknown) => {
        console.error('Failed to assign driver', err);
        this.assigning = false;
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────────
  statusChip(s: string) {
    return {
      'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300': s === 'Pending',
      'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300': s === 'In Progress',
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300': s === 'Delivered',
    };
  }
  statusDot(s: string) {
    return {
      'bg-amber-500': s === 'Pending',
      'bg-sky-500': s === 'In Progress',
      'bg-emerald-500': s === 'Delivered',
    };
  }

  /** KPIs for the header cards (based on filtered list) */
  get kpi() {
    const list = this.filteredOrders();
    const pending = list.filter(o => o.status === 'Pending').length;
    const inProgress = list.filter(o => o.status === 'In Progress').length;
    const revenue = list.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return { pending, inProgress, revenue };
  }
}
