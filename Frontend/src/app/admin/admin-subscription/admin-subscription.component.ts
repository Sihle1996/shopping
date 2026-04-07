import { Component, OnInit } from '@angular/core';
import { SubscriptionService, SubscriptionInfo } from '../../services/subscription.service';
import { ToastrService } from 'ngx-toastr';

declare var paypal: any;

interface PlanOption {
  name: string;
  priceUsd: number;
  isUpgrade: boolean;
}

@Component({
  selector: 'app-admin-subscription',
  templateUrl: './admin-subscription.component.html'
})
export class AdminSubscriptionComponent implements OnInit {
  info: SubscriptionInfo | null = null;
  loading = true;
  plans: PlanOption[] = [];

  upgradingPlan: string | null = null;
  paypalRendered = false;
  upgradeError = '';
  upgradeSuccess = false;
  upgradeSuccessPlan = '';

  constructor(
    private subscriptionService: SubscriptionService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.loading = true;
    this.subscriptionService.load().subscribe({
      next: info => {
        this.info = info;
        this.loading = false;
        this.subscriptionService.getPlans().subscribe({
          next: plans => this.plans = plans,
          error: () => {}
        });
      },
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

  get upgradablePlans(): PlanOption[] {
    return this.plans.filter(p => p.isUpgrade);
  }

  selectPlan(planName: string) {
    if (this.upgradingPlan === planName) {
      this.upgradingPlan = null;
      this.paypalRendered = false;
      return;
    }
    this.upgradingPlan = planName;
    this.paypalRendered = false;
    this.upgradeError = '';
    this.loadPayPalScript().then(() => {
      setTimeout(() => this.renderPayPalButtons(planName), 50);
    }).catch(() => {
      this.upgradeError = 'Could not load PayPal. Check your connection.';
    });
  }

  private renderPayPalButtons(planName: string) {
    const plan = this.plans.find(p => p.name === planName);
    if (!plan) return;

    const containerId = `paypal-sub-${planName}`;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    this.paypalRendered = true;

    (window as any)['paypal'].Buttons({
      createOrder: (_data: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{
            description: `${planName} Plan - Monthly Subscription`,
            amount: { value: plan.priceUsd.toFixed(2) }
          }]
        });
      },
      onApprove: (data: any, actions: any) => {
        return actions.order.capture().then((details: any) => {
          this.subscriptionService.upgradePlan(planName, details.id).subscribe({
            next: () => {
              this.upgradingPlan = null;
              this.upgradeSuccess = true;
              this.upgradeSuccessPlan = planName;
              this.toastr.success(`Upgraded to ${planName}!`);
              this.loadData();
            },
            error: () => {
              this.upgradeError = 'Payment received but upgrade failed. Contact support.';
            }
          });
        });
      },
      onError: () => {
        this.upgradeError = 'Payment failed. Please try again.';
      }
    }).render(`#${containerId}`);
  }

  private loadPayPalScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any)['paypal']) { resolve(); return; }
      const existing = document.getElementById('paypal-sdk');
      if (existing) { existing.addEventListener('load', () => resolve()); return; }
      const script = document.createElement('script');
      script.id = 'paypal-sdk';
      script.src = 'https://www.paypal.com/sdk/js?client-id=AQu3J8gnpoX5_Zy-JvKacc3L4kxMnLillZicsDvZePl0R5GG4RpX7xgENhm_6GotQiNTrFxDAYnGGTwR&currency=USD';
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.body.appendChild(script);
    });
  }
}
