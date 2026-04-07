import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

interface OrderSummary {
  orderId?: string;
  items: Array<{ name: string; quantity: number }>;
  total: number;
  address: string;
  loyaltyEarned: number;
}

@Component({
  selector: 'app-thank-you',
  templateUrl: './thank-you.component.html',
  styleUrls: ['./thank-you.component.scss']
})
export class ThankYouComponent implements OnInit {
  menuRoute = '/';
  ordersRoute = '/orders';
  summary: OrderSummary | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const slug = localStorage.getItem('storeSlug');
    this.menuRoute = slug ? `/store/${slug}` : '/';
    this.ordersRoute = slug ? `/store/${slug}/orders` : '/orders';

    try {
      const raw = localStorage.getItem('lastOrderSummary');
      if (raw) {
        this.summary = JSON.parse(raw);
        localStorage.removeItem('lastOrderSummary');
      }
    } catch {}
  }

  get itemsSummary(): string {
    if (!this.summary?.items?.length) return '';
    return this.summary.items
      .slice(0, 3)
      .map(i => `${i.quantity}x ${i.name}`)
      .join(', ') + (this.summary.items.length > 3 ? ` +${this.summary.items.length - 3} more` : '');
  }

  goToMenu(): void { this.router.navigateByUrl(this.menuRoute); }
  goToOrders(): void { this.router.navigateByUrl(this.ordersRoute); }
}
