import { Component, OnInit, OnDestroy } from '@angular/core';
import { DriverService } from 'src/app/services/driver.service';
import { ToastrService } from 'ngx-toastr';
import { DeliveryStop } from '../driver-map/driver-map.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Tiny inlined beep (single 440Hz tone, ~0.3s)
const BEEP_WAV = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAA' +
  'ABAAEAQB8AAEAfAAABAAgAZGF0YTtvT18A';

interface DriverOrder {
  id: string;
  status: string;
  totalAmount: number;
  orderDate: string;
  deliveryAddress: string;
  userEmail: string;
  userPhone?: string;
  orderNotes?: string;
  items: Array<{ name: string; quantity: number; size?: string }>;
  deliveryLat?: number;
  deliveryLon?: number;
}

@Component({
  selector: 'app-driver-dashboard',
  templateUrl: './driver-dashboard.component.html',
  styleUrls: ['./driver-dashboard.component.scss']
})
export class DriverDashboardComponent implements OnInit, OnDestroy {
  orders: DriverOrder[] = [];
  availability: 'AVAILABLE' | 'UNAVAILABLE' = 'AVAILABLE';
  isLoading = true;
  showDeliverConfirm = false;
  deliverTargetId: string | null = null;
  mapFullscreen = false;
  deliveryStops: DeliveryStop[] = [];
  earnings: { deliveredCount: number; totalEarnings: number } | null = null;
  profileIncomplete = false;
  showAllCompleted = false;

  lastUpdatedSeconds = 0;
  private pollInterval: any;
  private secondsInterval: any;
  private destroy$ = new Subject<void>();

  constructor(
    private driverService: DriverService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
    this.driverService.updateAvailability('AVAILABLE').pipe(takeUntil(this.destroy$)).subscribe();
    this.availability = 'AVAILABLE';
    this.driverService.getEarnings().pipe(takeUntil(this.destroy$)).subscribe({
      next: e => this.earnings = e
    });
    this.driverService.getProfile().pipe(takeUntil(this.destroy$)).subscribe({
      next: p => this.profileIncomplete = !p.fullName || !p.phone
    });

    // Auto-refresh every 30s
    this.pollInterval = setInterval(() => this.silentRefresh(), 30000);
    // Update "last updated" counter every second
    this.secondsInterval = setInterval(() => this.lastUpdatedSeconds++, 1000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearInterval(this.pollInterval);
    clearInterval(this.secondsInterval);
  }

  loadOrders(): void {
    this.isLoading = true;
    this.driverService.getAssignedOrders().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.orders = res;
        this.deliveryStops = this.activeOrders.map(o => ({
          id: o.id,
          address: o.deliveryAddress,
          label: `Order #${o.id.substring(0, 8)}`,
          lat: o.deliveryLat,
          lon: o.deliveryLon
        }));
        this.isLoading = false;
        this.lastUpdatedSeconds = 0;
      },
      error: () => this.isLoading = false
    });
  }

  private silentRefresh(): void {
    const prevActiveCount = this.activeOrders.length;
    this.driverService.getAssignedOrders().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const newActiveCount = res.filter(o => o.status !== 'Delivered').length;
        if (newActiveCount > prevActiveCount) {
          this.toastr.info('New order assigned!', '', { timeOut: 6000 });
          try { new Audio(BEEP_WAV).play(); } catch (_) {}
        }
        this.orders = res;
        this.deliveryStops = this.activeOrders.map(o => ({
          id: o.id,
          address: o.deliveryAddress,
          label: `Order #${o.id.substring(0, 8)}`,
          lat: o.deliveryLat,
          lon: o.deliveryLon
        }));
        this.lastUpdatedSeconds = 0;
      },
      error: () => {}
    });
  }

  get activeOrders(): DriverOrder[] {
    return this.orders.filter(o => o.status !== 'Delivered');
  }

  get completedOrders(): DriverOrder[] {
    return this.orders.filter(o => o.status === 'Delivered');
  }

  get currentDelivery(): DriverOrder | null {
    return this.activeOrders[0] || null;
  }

  get lastUpdatedLabel(): string {
    if (this.lastUpdatedSeconds < 60) return `${this.lastUpdatedSeconds}s ago`;
    return `${Math.floor(this.lastUpdatedSeconds / 60)}m ago`;
  }

  confirmDeliver(id: string): void {
    this.deliverTargetId = id;
    this.showDeliverConfirm = true;
  }

  onDeliverConfirmed(): void {
    if (!this.deliverTargetId) return;
    this.driverService.markAsDelivered(this.deliverTargetId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toastr.success('Order marked as delivered');
        this.loadOrders();
      },
      error: () => this.toastr.error('Failed to update order')
    });
    this.showDeliverConfirm = false;
    this.deliverTargetId = null;
  }

  onDeliverCancelled(): void {
    this.showDeliverConfirm = false;
    this.deliverTargetId = null;
  }

  toggleAvailability(): void {
    const newStatus = this.availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    this.driverService.updateAvailability(newStatus).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.availability = newStatus;
        this.toastr.success(newStatus === 'AVAILABLE' ? 'You are now online' : 'You are now offline');
      },
      error: () => this.toastr.error('Failed to update availability')
    });
  }

  get isOnline(): boolean {
    return this.availability === 'AVAILABLE';
  }

  openNavigation(order: DriverOrder): void {
    const dest = (order.deliveryLat && order.deliveryLon)
      ? `${order.deliveryLat},${order.deliveryLon}`
      : encodeURIComponent(order.deliveryAddress);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
  }

  driverEarning(order: DriverOrder): number {
    return Math.round((order.totalAmount ?? 0) * 0.1 * 100) / 100;
  }

  get visibleCompletedEarnings(): number {
    const visible = this.showAllCompleted ? this.completedOrders : this.completedOrders.slice(0, 4);
    return Math.round(visible.reduce((sum, o) => sum + (o.totalAmount ?? 0) * 0.1, 0) * 100) / 100;
  }
}
