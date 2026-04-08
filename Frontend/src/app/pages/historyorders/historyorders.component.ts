import { Component, OnInit, OnDestroy, AfterViewChecked } from '@angular/core';
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
import mapboxgl from 'mapbox-gl';

interface OrderItemDTO {
  productId: string;
  name: string;
  quantity: number;
  size?: string;
  price: number;
  selectedChoices?: any[];
}

interface OrderDTO {
  id: string;
  status: string;
  totalAmount: number;
  discountAmount?: number;
  promoCode?: string;
  orderDate: string;
  deliveryAddress: string;
  orderNotes?: string;
  items?: OrderItemDTO[];
  driverLat?: number;
  driverLon?: number;
  driverName?: string;
  deliveryLat?: number;
  deliveryLon?: number;
}

@Component({
  selector: 'app-historyorders',
  templateUrl: './historyorders.component.html',
  styleUrls: ['./historyorders.component.scss']
})
export class HistoryordersComponent implements OnInit, OnDestroy, AfterViewChecked {
  orders: OrderDTO[] = [];
  filteredOrders: OrderDTO[] = [];
  loading = true;
  errorMessage = '';
  currentPage = 1;
  itemsPerPage = 5;
  selectedStatus = 'All';
  allStatuses: string[] = ['All', 'Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

  reorderingId: string | null = null;
  cancellingId: string | null = null;
  private wsSub?: Subscription;

  // Review modal state
  reviewModalOpen = false;
  reviewOrderId: string | null = null;
  reviewTargetOrder: OrderDTO | null = null;
  reviewRating = 0;
  reviewComment = '';
  reviewSubmitting = false;
  reviewedOrderIds = new Set<string>();

  // Loyalty
  loyaltyBalance: LoyaltyBalance | null = null;

  // Tracking
  trackingOrder: OrderDTO | null = null;
  private trackingMap: mapboxgl.Map | null = null;
  private trackingMarker: mapboxgl.Marker | null = null;
  private mapInitPending = false;

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
    this.trackingMap?.remove();
  }

  ngAfterViewChecked(): void {
    if (this.mapInitPending && document.getElementById('customer-tracking-map')) {
      this.mapInitPending = false;
      this.initTrackingMap();
    }
  }

  openTracking(order: OrderDTO): void {
    this.trackingOrder = order;
    this.trackingMap?.remove();
    this.trackingMap = null;
    this.mapInitPending = true;
  }

  closeTracking(): void {
    this.trackingMap?.remove();
    this.trackingMap = null;
    this.trackingMarker = null;
    this.trackingOrder = null;
  }

  private initTrackingMap(): void {
    if (!this.trackingOrder?.driverLat || !this.trackingOrder?.driverLon) return;
    (mapboxgl as any).accessToken = environment.mapboxToken;
    this.trackingMap = new mapboxgl.Map({
      container: 'customer-tracking-map',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [this.trackingOrder.driverLon, this.trackingOrder.driverLat],
      zoom: 14
    });
    // Driver marker
    const el = document.createElement('div');
    el.innerHTML = '<i class="bi bi-bicycle" style="font-size:22px;color:#FF6F00"></i>';
    this.trackingMarker = new mapboxgl.Marker({ element: el })
      .setLngLat([this.trackingOrder.driverLon, this.trackingOrder.driverLat])
      .addTo(this.trackingMap);
    // Delivery pin
    if (this.trackingOrder.deliveryLat && this.trackingOrder.deliveryLon) {
      new mapboxgl.Marker({ color: '#10b981' })
        .setLngLat([this.trackingOrder.deliveryLon, this.trackingOrder.deliveryLat])
        .addTo(this.trackingMap!);
    }
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
    const slug = localStorage.getItem('storeSlug');
    slug ? this.router.navigate(['/store', slug]) : this.router.navigate(['/']);
  }

  goBack(): void {
    const slug = localStorage.getItem('storeSlug');
    slug ? this.router.navigate(['/store', slug]) : this.router.navigate(['/']);
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

  openReview(order: OrderDTO): void {
    this.reviewOrderId = order.id;
    this.reviewTargetOrder = order;
    this.reviewRating = 0;
    this.reviewComment = '';
    this.reviewModalOpen = true;
  }

  closeReview(): void {
    this.reviewModalOpen = false;
    this.reviewOrderId = null;
    this.reviewTargetOrder = null;
  }

  setReviewRating(r: number): void { this.reviewRating = r; }

  submitReview(): void {
    if (!this.reviewOrderId || this.reviewRating < 1) return;
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
      this.cartService.addToCart(
        item.productId,
        item.quantity,
        item.size || null,
        item.selectedChoices ? JSON.stringify(item.selectedChoices) : undefined
      )
    );
    let done = 0;
    adds.forEach(obs => obs.subscribe({
      next: () => {
        done++;
        if (done === adds.length) {
          this.reorderingId = null;
          this.toastr.success('Items added to cart at current prices');
          if (order.promoCode) {
            this.toastr.info(`Note: previous promotion "${order.promoCode}" may no longer apply`, '', { timeOut: 5000 });
          }
        }
      },
      error: () => { this.reorderingId = null; this.toastr.error('Could not reorder some items — they may be out of stock'); }
    }));
  }

  cancelOrder(order: OrderDTO): void {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    this.cancellingId = order.id;
    const token = this.authService.getToken();
    const headers = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
    this.http.patch<OrderDTO>(`${environment.apiUrl}/api/orders/${order.id}/cancel`, {}, { headers }).subscribe({
      next: (updated) => {
        const idx = this.orders.findIndex(o => o.id === order.id);
        if (idx !== -1) this.orders[idx] = updated;
        this.applyFilter();
        this.cancellingId = null;
        this.toastr.success('Order cancelled successfully');
      },
      error: (err) => {
        this.cancellingId = null;
        const msg = err.error?.error || 'Could not cancel order';
        this.toastr.error(msg);
      }
    });
  }
}
