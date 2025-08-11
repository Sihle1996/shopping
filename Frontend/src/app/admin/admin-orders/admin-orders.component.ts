// src/app/admin/admin-orders/admin-orders.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AdminService, Order, Page, Driver } from 'src/app/services/admin.service';

@Component({
  selector: 'app-admin-orders',
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  selectedOrder: Order | null = null;
  availableDrivers: Driver[] = [];

  loading = true;
  assigning = false;
  errorMessage = '';

  filterStatus: 'All' | 'PENDING' | 'PAID' | 'ASSIGNED' | 'DELIVERED' | 'CANCELLED' = 'All';
  currentPage = 1;
  pageSize = 10;
  totalPages = 0;
  searchQuery = '';

  selectedDriverId: number | null = null;

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;
  private ordersSub?: Subscription;

  constructor(private adminSerivce: AdminService) {}

  ngOnInit(): void {
    this.fetchOrders();
    this.searchSub = this.searchSubject.pipe(debounceTime(300)).subscribe(q => {
      this.searchQuery = q.trim();
      this.fetchOrders(1);
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.ordersSub?.unsubscribe();
  }

  fetchOrders(page: number = this.currentPage): void {
    this.loading = true;
    this.ordersSub = this.adminSerivce.getOrders(page - 1, this.pageSize, this.searchQuery).subscribe({
      next: (res: Page<Order>) => {
        this.orders = res.content ?? [];
        this.totalPages = res.totalPages ?? 0;
        this.currentPage = page;
        this.loading = false;
      },
      error: (err: unknown) => {
        this.errorMessage = 'Failed to load orders.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  onSearch(term: string): void { this.searchSubject.next(term); }
  onPageChange(page: number): void { this.fetchOrders(page); }
  onFilterChange(status: typeof this.filterStatus): void { this.filterStatus = status; this.fetchOrders(1); }

  updateStatus(orderId: number, newStatus: string): void {
    // optional local optimistic UI
    const prev = this.orders.slice();
    this.orders = this.orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);

    this.adminSerivce.updateOrderStatus(orderId, newStatus).subscribe({
      next: () => {},
      error: (err: unknown) => {
        // rollback on failure
        this.orders = prev;
        console.error('Failed to update status', err);
      }
    });
  }

  openModal(order: Order): void {
    this.selectedOrder = order;
    this.selectedDriverId = null;

    this.adminSerivce.getAvailableDrivers().subscribe({
      next: (drivers: Driver[]) => this.availableDrivers = drivers ?? [],
      error: (err: unknown) => console.error('Failed to load drivers', err)
    });
  }

  closeModal(): void {
    this.selectedOrder = null;
    this.selectedDriverId = null;
  }

  assignDriver(): void {
    if (!this.selectedOrder || !this.selectedDriverId) return;
    this.assigning = true;

    this.adminSerivce.assignDriver(this.selectedOrder.id, this.selectedDriverId).subscribe({
      next: () => {
        // reflect immediately
        this.orders = this.orders.map(o =>
          o.id === this.selectedOrder!.id ? { ...o, status: 'ASSIGNED' } : o
        );
        this.assigning = false;
        this.closeModal();
      },
      error: (err: unknown) => {
        this.assigning = false;
        console.error('Failed to assign driver', err);
      }
    });
  }

  trackByOrderId = (_: number, o: Order) => o.id;
  getStatusColor(status: string): string {
    switch (status) {
      case 'PAID': return 'green';
      case 'PENDING': return 'gray';
      case 'ASSIGNED': return 'blue';
      case 'DELIVERED': return 'teal';
      case 'CANCELLED': return 'red';
      default: return 'gray';
    }
  }
}
