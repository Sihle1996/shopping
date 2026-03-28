import { Component, OnInit, OnDestroy } from '@angular/core';
import { DriverService } from 'src/app/services/driver.service';
import { ToastrService } from 'ngx-toastr';
import { DeliveryStop } from '../driver-map/driver-map.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface DriverOrder {
  id: string;
  status: string;
  totalAmount: number;
  orderDate: string;
  deliveryAddress: string;
  userEmail: string;
  items: Array<{ name: string; quantity: number; size?: string }>;
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
  private destroy$ = new Subject<void>();

  constructor(
    private driverService: DriverService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
    // Set driver as available when dashboard opens
    this.driverService.updateAvailability('AVAILABLE').pipe(takeUntil(this.destroy$)).subscribe();
    this.availability = 'AVAILABLE';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.driverService.getAssignedOrders().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.orders = res;
        this.deliveryStops = this.activeOrders.map(o => ({
          id: o.id,
          address: o.deliveryAddress,
          label: `Order #${o.id.substring(0, 8)}`
        }));
        this.isLoading = false;
      },
      error: () => this.isLoading = false
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
}
