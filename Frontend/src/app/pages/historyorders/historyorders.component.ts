import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';

interface OrderDTO {
  id: number;
  status: string;
  totalAmount: number;
  orderDate: string;
  deliveryAddress: string;
}

@Component({
  selector: 'app-historyorders',
  templateUrl: './historyorders.component.html',
  styleUrls: ['./historyorders.component.scss']
})
export class HistoryordersComponent implements OnInit {
  orders: OrderDTO[] = [];
  filteredOrders: OrderDTO[] = [];
  loading = true;
  errorMessage = '';
  currentPage = 1;
  itemsPerPage = 3;
  selectedStatus = 'All';
  allStatuses: string[] = ['All', 'Pending', 'Preparing', 'Delivered'];

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit(): void {
    this.fetchOrders();
  }

  fetchOrders(): void {
    const token = this.authService.getToken();
    if (!token) {
      this.errorMessage = "User not authenticated.";
      this.loading = false;
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<OrderDTO[]>('http://localhost:8080/api/orders', { headers }).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to fetch orders.';
        this.loading = false;
      }
    });
  }

  applyFilter(): void {
    this.currentPage = 1;
    if (this.selectedStatus === 'All') {
      this.filteredOrders = this.orders;
    } else {
      this.filteredOrders = this.orders.filter(order => order.status === this.selectedStatus);
    }
  }

  get paginatedOrders(): OrderDTO[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredOrders.slice(start, start + this.itemsPerPage);
  }

  totalPages(): number {
    return Math.ceil(this.filteredOrders.length / this.itemsPerPage);
  }

  changePage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.totalPages()) {
      this.currentPage = newPage;
    }
  }

  getProgressBarColor(status: string): string {
    switch (status) {
      case 'Pending': return 'bg-red-500';
      case 'Preparing': return 'bg-orange-500';
      case 'Delivered': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  }

  getProgressPercent(status: string): string {
    switch (status) {
      case 'Pending': return '33%';
      case 'Preparing': return '66%';
      case 'Delivered': return '100%';
      default: return '0%';
    }
  }
}
