import { Component, OnInit } from '@angular/core';
import { SubscriptionService, SubscriptionInfo } from '../../services/subscription.service';

@Component({
  selector: 'app-admin-subscription',
  templateUrl: './admin-subscription.component.html'
})
export class AdminSubscriptionComponent implements OnInit {
  info: SubscriptionInfo | null = null;
  loading = true;
  upgradeRequested = false;
  upgradeError = '';

  constructor(private subscriptionService: SubscriptionService) {}

  ngOnInit() {
    this.subscriptionService.load().subscribe({
      next: info => { this.info = info; this.loading = false; },
      error: () => this.loading = false
    });
  }

  usagePercent(current: number, max: number): number {
    if (max <= 0) return 100;
    return Math.min(100, Math.round((current / max) * 100));
  }

  barColor(percent: number): string {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-400';
    return 'bg-green-500';
  }

  requestUpgrade() {
    this.subscriptionService.requestUpgrade().subscribe({
      next: () => this.upgradeRequested = true,
      error: () => this.upgradeError = 'Failed to send upgrade request. Please try again.'
    });
  }
}
