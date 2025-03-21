import { Component } from '@angular/core';
import { Order, OrderService } from 'src/app/services/order.service';

@Component({
  selector: 'app-historyorders',
  templateUrl: './historyorders.component.html',
  styleUrls: ['./historyorders.component.scss']
})
export class HistoryordersComponent {
  orders: Order[] = [];
  loading = true;
  errorMessage = '';

  constructor(private orderService: OrderService) {}

  ngOnInit(): void {
    this.orderService.getUserOrders().subscribe({
      next: (data) => {
        this.orders = data;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = 'Failed to fetch orders.';
        console.error("❌ Error loading orders:", err);
        this.loading = false;
      }
    });
  }
}
