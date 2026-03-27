import { Component, OnInit } from '@angular/core';
import { DriverService } from 'src/app/services/driver.service';
import { ToastrService } from 'ngx-toastr';

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
export class DriverDashboardComponent implements OnInit {
  orders: DriverOrder[] = [];
  availability: 'AVAILABLE' | 'UNAVAILABLE' = 'AVAILABLE';
  isLoading = true;
  showDeliverConfirm = false;
  deliverTargetId: string | null = null;
  mapFullscreen = false;

  constructor(
    private driverService: DriverService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
    // Set driver as available when dashboard opens
    this.driverService.updateAvailability('AVAILABLE').subscribe();
    this.availability = 'AVAILABLE';
  }

  loadOrders(): void {
    this.isLoading = true;
    this.driverService.getAssignedOrders().subscribe({
      next: (res) => {
        this.orders = res;
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
    this.driverService.markAsDelivered(this.deliverTargetId).subscribe({
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
    this.driverService.updateAvailability(newStatus).subscribe({
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
