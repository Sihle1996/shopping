import { Component, OnInit, OnDestroy } from '@angular/core';
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
  deliveryOtp?: string;
}

const STATUS_STEPS = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'];
const TERMINAL_STATUSES = ['Delivered', 'Cancelled', 'Rejected'];

@Component({
  selector: 'app-track-order',
  templateUrl: './track-order.component.html'
})
export class TrackOrderComponent implements OnInit, OnDestroy {
  orderId = '';
  email = '';
  result: TrackResult | null = null;
  loading = false;
  error = '';
  requiresLogin = false;
  private pollInterval: any = null;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) {
      this.orderId = id;
      const email = this.route.snapshot.queryParamMap.get('email');
      if (email) this.email = email;
      this.track();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  track(): void {
    const id = this.orderId.trim();
    if (!id) return;
    this.loading = true;
    this.error = '';
    this.requiresLogin = false;
    this.result = null;
    this.stopPolling();
    this.fetchStatus(id);
  }

  private fetchStatus(id: string): void {
    let url = `${environment.apiUrl}/api/orders/track/${id}`;
    if (this.email.trim()) url += `?email=${encodeURIComponent(this.email.trim())}`;

    this.http.get<TrackResult>(url).subscribe({
      next: r => {
        this.result = r;
        this.loading = false;
        if (!TERMINAL_STATUSES.includes(r.status)) {
          this.startPolling(id);
        }
      },
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

  private startPolling(id: string): void {
    this.pollInterval = setInterval(() => {
      let url = `${environment.apiUrl}/api/orders/track/${id}`;
      if (this.email.trim()) url += `?email=${encodeURIComponent(this.email.trim())}`;
      this.http.get<TrackResult>(url).subscribe({
        next: r => {
          this.result = r;
          if (TERMINAL_STATUSES.includes(r.status)) this.stopPolling();
        },
        error: () => { /* silently ignore poll errors */ }
      });
    }, 30000);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  get stepIndex(): number {
    return STATUS_STEPS.indexOf(this.result?.status || '');
  }

  get statusSteps(): string[] {
    return STATUS_STEPS;
  }
}
