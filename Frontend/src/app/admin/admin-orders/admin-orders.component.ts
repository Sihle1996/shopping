import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AdminService } from 'src/app/services/admin.service';

interface OrderItem {
  name: string;
  quantity: number;
  size: string;
}

interface Order {
  id: number;
  totalAmount: number;
  status: string;
  orderDate: string;
  deliveryAddress: string;
  userEmail: string;
  paymentId: string;
  items: OrderItem[];
}

@Component({
  selector: 'app-admin-orders',
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  loading = true;
  errorMessage = '';
  selectedOrder: Order | null = null;
  filterStatus = 'All';
  availableDrivers: any[] = [];
  selectedDriverId: number | null = null;
  assigning = false;

  currentPage = 1;
  pageSize = 5;
  totalPages = 0;
  searchQuery = '';
  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;

  constructor(
    private adminSerivce: AdminService
  ) {}

  ngOnInit(): void {
    this.fetchOrders();
    this.searchSub = this.searchSubject.pipe(debounceTime(300)).subscribe(q => {
      this.searchQuery = q;
      this.fetchOrders(1);
    });
  }

  ngOnDestroy(): void {
    this.searchSub.unsubscribe();
  }

  fetchOrders(page: number = this.currentPage): void {
    this.loading = true;
    this.adminSerivce.getOrders(page - 1, this.pageSize, this.searchQuery).subscribe({
      next: (res) => {
        this.orders = res.content;
        this.totalPages = res.totalPages;
        this.currentPage = page;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = 'Failed to load orders.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  onSearch(term: string): void {
    this.searchSubject.next(term);
  }

  onPageChange(page: number): void {
    this.fetchOrders(page);
  }

  updateStatus(orderId: number, newStatus: string): void {
    this.adminSerivce.updateOrderStatus(orderId, newStatus).subscribe({
      next: () => {
        this.orders = this.orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
      },
      error: (err) => console.error('Failed to update status', err)
    });
  }

  openModal(order: Order): void {
    this.selectedOrder = order;
    this.adminSerivce.getAvailableDrivers().subscribe({
      next: (drivers) => this.availableDrivers = drivers,
      error: (err) => console.error('Failed to load drivers', err)
    });
  }

  closeModal(): void {
    this.selectedOrder = null;
  }

  assignDriver(): void {
    if (!this.selectedOrder || !this.selectedDriverId) return;
    this.assigning = true;
    this.adminSerivce.assignDriver(this.selectedOrder.id, this.selectedDriverId).subscribe({
      next: (updated) => {
        this.selectedOrder = updated;
        alert('✅ Driver assigned!');
        this.assigning = false;
      },
      error: (err) => {
        console.error('Failed to assign driver', err);
        alert('❌ Failed to assign driver');
        this.assigning = false;
      }
    });
  }

  filteredOrders(): Order[] {
    if (this.filterStatus === 'All') return this.orders;
    return this.orders.filter(o => o.status === this.filterStatus);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Pending': return 'text-red-600';
      case 'In Progress': return 'text-yellow-600';
      case 'Delivered': return 'text-green-600';
      default: return 'text-gray-600';
    }
  }
}
