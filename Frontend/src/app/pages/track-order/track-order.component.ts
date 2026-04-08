import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

interface TrackResult {
  id: string;
  status: string;
  orderDate: string;
  deliveryAddress: string;
  totalAmount: number;
  deliveryFee: number;
  items: Array<{ name: string; quantity: number }>;
}

const STATUS_STEPS = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered'];

@Component({
  selector: 'app-track-order',
  templateUrl: './track-order.component.html'
})
export class TrackOrderComponent implements OnInit {
  orderId = '';
  email = '';
  result: TrackResult | null = null;
  loading = false;
  error = '';
  requiresLogin = false;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) {
      this.orderId = id;
    }
  }

  track(): void {
    const id = this.orderId.trim();
    if (!id) return;
    this.loading = true;
    this.error = '';
    this.requiresLogin = false;
    this.result = null;

    let url = `${environment.apiUrl}/api/orders/track/${id}`;
    if (this.email.trim()) url += `?email=${encodeURIComponent(this.email.trim())}`;

    this.http.get<TrackResult>(url).subscribe({
      next: r => { this.result = r; this.loading = false; },
      error: err => {
        this.loading = false;
        if (err.status === 403) {
          const msg = err.error?.error || '';
          if (msg.includes('login')) {
            this.requiresLogin = true;
          } else {
            this.error = 'Email address does not match. Please double-check and try again.';
          }
        } else if (err.status === 404) {
          this.error = 'Order not found. Please check the order ID.';
        } else {
          this.error = 'Could not retrieve order. Please try again.';
        }
      }
    });
  }

  get stepIndex(): number {
    return STATUS_STEPS.indexOf(this.result?.status || '');
  }

  get statusSteps(): string[] {
    return STATUS_STEPS;
  }
}
