import { Component, OnInit } from '@angular/core';
import { DriverService } from 'src/app/services/driver.service';

@Component({
  selector: 'app-driver-dashboard',
  templateUrl: './driver-dashboard.component.html',
  styleUrls: ['./driver-dashboard.component.scss']
})
export class DriverDashboardComponent implements OnInit {
  orders: any[] = [];
  availability: 'AVAILABLE' | 'UNAVAILABLE' = 'AVAILABLE';

  constructor(private driverService: DriverService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders() {
    this.driverService.getAssignedOrders().subscribe({
      next: (res) => this.orders = res,
      error: (err) => console.error('Error fetching orders', err)
    });
  }

  markDelivered(id: number) {
    this.driverService.markAsDelivered(id).subscribe(() => this.loadOrders());
  }

  toggleAvailability() {
    this.availability = this.availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    this.driverService.updateAvailability(this.availability).subscribe();
  }

  get firstUndeliveredOrder() {
    return this.orders.find(order =>
      order.status && order.status.trim().toLowerCase() !== 'delivered'
    );
  }
}
