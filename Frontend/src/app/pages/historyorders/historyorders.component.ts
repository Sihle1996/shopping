import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { environment } from 'src/environments/environment';
import { BadgeVariant } from 'src/app/shared/components/badge/badge.component';

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
  itemsPerPage = 5;
  selectedStatus = 'All';
  allStatuses: string[] = ['All', 'Pending', 'Preparing', 'Delivered'];

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fetchOrders();
  }

  fetchOrders(): void {
    const token = this.authService.getToken();
    if (!token) {
      this.errorMessage = 'User not authenticated.';
      this.loading = false;
      return;
    }

    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<OrderDTO[]>(`${environment.apiUrl}/api/orders`, { headers }).subscribe({
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
    this.filteredOrders = this.selectedStatus === 'All'
      ? this.orders
      : this.orders.filter(order => order.status === this.selectedStatus);
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

  goToMenu(): void {
    this.router.navigate(['/']);
  }

  getStatusBadgeVariant(status: string): BadgeVariant {
    switch (status) {
      case 'Pending': return 'warning';
      case 'Preparing': return 'primary';
      case 'Delivered': return 'success';
      default: return 'neutral';
    }
  }

  getProgressBarColor(status: string): string {
    switch (status) {
      case 'Pending': return 'bg-warning';
      case 'Preparing': return 'bg-primary';
      case 'Delivered': return 'bg-success';
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

  getStatusChipClasses(status: string): string {
    const base = 'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-95';
    return this.selectedStatus === status
      ? `${base} bg-primary text-white shadow-sm`
      : `${base} bg-white text-textDark hover:bg-primary-50 shadow-card`;
  }

  getPageBtnClasses(page: number): string {
    const base = 'w-9 h-9 rounded-full text-sm font-medium flex items-center justify-center transition-all';
    return this.currentPage === page
      ? `${base} bg-primary text-white`
      : `${base} text-textDark hover:bg-gray-100`;
  }

  trackById(_: number, order: OrderDTO): number {
    return order.id;
  }
}
