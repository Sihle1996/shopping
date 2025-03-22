import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';

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
export class AdminOrdersComponent implements OnInit {
  orders: Order[] = [];
  loading = true;
  errorMessage = '';
  selectedOrder: Order | null = null;
  filterStatus = 'All';

  currentPage = 1;
  pageSize = 5;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.fetchOrders();
  }

  get authHeaders() {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${this.authService.getToken()}`
      })
    };
  }

  fetchOrders(): void {
    this.loading = true;
    this.http.get<Order[]>('http://localhost:8080/api/admin/orders', this.authHeaders).subscribe({
      next: (data) => {
        this.orders = data;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = 'Failed to load orders.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  updateStatus(orderId: number, newStatus: string): void {
    this.http.put(
      `http://localhost:8080/api/admin/orders/update/${orderId}?status=${newStatus}`,
      {},
      this.authHeaders
    ).subscribe({
      next: () => {
        this.orders = this.orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
      },
      error: (err) => console.error('Failed to update status', err)
    });
  }

  filterOrders(): void {
    this.currentPage = 1;
  }

  filteredOrders(): Order[] {
    if (this.filterStatus === 'All') return this.orders;
    return this.orders.filter(o => o.status === this.filterStatus);
  }

  paginatedOrders(): Order[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredOrders().slice(start, start + this.pageSize);
  }

  totalPages(): number {
    return Math.ceil(this.filteredOrders().length / this.pageSize);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages()) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  openModal(order: Order): void {
    this.selectedOrder = order;
  }

  closeModal(): void {
    this.selectedOrder = null;
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
