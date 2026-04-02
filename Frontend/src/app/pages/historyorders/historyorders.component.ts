import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { CartService } from 'src/app/services/cart.service';
import { NotificationService } from 'src/app/services/notification.service';
import { ReviewService } from 'src/app/services/review.service';
import { LoyaltyService, LoyaltyBalance } from 'src/app/services/loyalty.service';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { environment } from 'src/environments/environment';
import { BadgeVariant } from 'src/app/shared/components/badge/badge.component';

interface OrderItemDTO {
  productId: string;
  name: string;
  quantity: number;
  size?: string;
  price: number;
}

interface OrderDTO {
  id: string;
  status: string;
  totalAmount: number;
  discountAmount?: number;
  promoCode?: string;
  orderDate: string;
  deliveryAddress: string;
  items?: OrderItemDTO[];
}

@Component({
  selector: 'app-historyorders',
  templateUrl: './historyorders.component.html',
  styleUrls: ['./historyorders.component.scss']
})
export class HistoryordersComponent implements OnInit, OnDestroy {
  orders: OrderDTO[] = [];
  filteredOrders: OrderDTO[] = [];
  loading = true;
  errorMessage = '';
  currentPage = 1;
  itemsPerPage = 5;
  selectedStatus = 'All';
  allStatuses: string[] = ['All', 'Pending', 'Preparing', 'Out for Delivery', 'Delivered'];

  reorderingId: string | null = null;
  private wsSub?: Subscription;

  // Review modal state
  reviewModalOpen = false;
  reviewOrderId: string | null = null;
  reviewRating = 5;
  reviewComment = '';
  reviewSubmitting = false;
  reviewedOrderIds = new Set<string>();

  // Loyalty
  loyaltyBalance: LoyaltyBalance | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cartService: CartService,
    private notificationService: NotificationService,
    private reviewService: ReviewService,
    private loyaltyService: LoyaltyService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fetchOrders();
    if (this.authService.isLoggedIn()) {
      this.loyaltyService.getBalance().subscribe({ next: b => this.loyaltyBalance = b, error: () => {} });
    }
    const userId = this.authService.getUserId();
    if (userId) {
      this.wsSub = this.notificationService.subscribeToOrderUpdates(userId).subscribe(updated => {
        const idx = this.orders.findIndex(o => o.id === updated.id);
        if (idx >= 0) {
          this.orders[idx] = { ...this.orders[idx], ...updated };
          this.applyFilter();
          this.toastr.info(`Order #${updated.id?.substring(0, 8)} is now ${updated.status}`, 'Order Update');
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
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
      case 'Out for Delivery': return 'primary';
      case 'Delivered': return 'success';
      default: return 'neutral';
    }
  }

  getProgressBarColor(status: string): string {
    switch (status) {
      case 'Pending': return 'bg-warning';
      case 'Preparing': return 'bg-blue-500';
      case 'Out for Delivery': return 'bg-purple-500';
      case 'Delivered': return 'bg-success';
      default: return 'bg-gray-300';
    }
  }

  getProgressPercent(status: string): string {
    switch (status) {
      case 'Pending': return '25%';
      case 'Preparing': return '50%';
      case 'Out for Delivery': return '75%';
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

  trackById(_: number, order: OrderDTO): string {
    return order.id;
  }

  openReview(orderId: string): void {
    this.reviewOrderId = orderId;
    this.reviewRating = 5;
    this.reviewComment = '';
    this.reviewModalOpen = true;
  }

  closeReview(): void {
    this.reviewModalOpen = false;
    this.reviewOrderId = null;
  }

  setReviewRating(r: number): void { this.reviewRating = r; }

  submitReview(): void {
    if (!this.reviewOrderId) return;
    this.reviewSubmitting = true;
    this.reviewService.submitReview(this.reviewOrderId, this.reviewRating, this.reviewComment).subscribe({
      next: () => {
        this.reviewedOrderIds.add(this.reviewOrderId!);
        this.reviewSubmitting = false;
        this.closeReview();
        this.toastr.success('Thanks for your review!');
      },
      error: (err) => {
        this.reviewSubmitting = false;
        this.toastr.error(err?.error || 'Could not submit review.');
      }
    });
  }

  canReview(order: OrderDTO): boolean {
    return order.status === 'Delivered' && !this.reviewedOrderIds.has(order.id);
  }

  reorder(order: OrderDTO): void {
    if (!order.items?.length) { this.toastr.warning('No items to reorder'); return; }
    this.reorderingId = order.id;
    const adds = order.items.map(item =>
      this.cartService.addToCart(item.productId, item.quantity, item.size || 'Regular')
    );
    let done = 0;
    adds.forEach(obs => obs.subscribe({
      next: () => { done++; if (done === adds.length) { this.reorderingId = null; this.toastr.success('Items added to cart'); } },
      error: () => { this.reorderingId = null; this.toastr.error('Could not reorder some items'); }
    }));
  }
}
