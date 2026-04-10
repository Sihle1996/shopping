import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SubscriptionService, SubscriptionInfo } from '../../services/subscription.service';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

interface PlanOption {
  name: string;
  priceZar: number;
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
  payFastLoading = false;
  upgradeError = '';
  upgradeSuccess = false;
  upgradeSuccessPlan = '';

  constructor(
    private subscriptionService: SubscriptionService,
    private toastr: ToastrService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    const payment = this.route.snapshot.queryParamMap.get('payment');
    const plan    = this.route.snapshot.queryParamMap.get('plan');

    // Clear query params immediately so a page refresh doesn't re-trigger
    this.router.navigate([], { replaceUrl: true, queryParams: {} });

    if (payment === 'success' && plan) {
      this.finalizeUpgrade(plan);
    } else if (payment === 'cancelled') {
      this.toastr.warning('Payment was cancelled');
      this.loadData();
    } else {
      this.loadData();
    }
  }

  /**
   * Called after returning from PayFast. Activates the subscription on the
   * backend as a fallback for environments where the ITN can't reach localhost.
   * In production the ITN fires first; a duplicate call is harmless (returns 400
   * "already on this plan" which we swallow).
   */
  private finalizeUpgrade(planName: string) {
    const tenantId = localStorage.getItem('tenantId');
    const headers: any = { 'Content-Type': 'application/json' };
    if (tenantId) headers['X-Tenant-Id'] = tenantId;

    this.http.post<any>(
      `${environment.apiUrl}/api/admin/subscription/upgrade`,
      { planName },
      { headers }
    ).subscribe({
      next: () => {
        this.upgradeSuccess = true;
        this.upgradeSuccessPlan = planName;
        this.loadData();
      },
      error: () => {
        // ITN may have already activated it — reload to reflect current state
        this.upgradeSuccess = true;
        this.upgradeSuccessPlan = planName;
        this.loadData();
      }
    });
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
      return;
    }
    this.upgradingPlan = planName;
    this.upgradeError = '';
  }

  confirmUpgrade(planName: string) {
    const plan = this.plans.find(p => p.name === planName);
    if (!plan) return;

    this.payFastLoading = true;
    this.upgradeError = '';

    const amount = plan.priceZar;
    const tenantId = localStorage.getItem('tenantId');
    const headers: any = { 'Content-Type': 'application/json' };
    if (tenantId) headers['X-Tenant-Id'] = tenantId;

    this.http.post<any>(`${environment.apiUrl}/api/payfast/initiate`, {
      total: amount.toFixed(2),
      itemName: `${planName} Plan Subscription`,
      paymentId: `sub-${tenantId}-${planName}`
    }, { headers }).subscribe({
      next: (res) => {
        this.payFastLoading = false;
        // Build and auto-submit form
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = res.processUrl;
        for (const [key, val] of Object.entries(res.formData)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = val as string;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      },
      error: () => {
        this.payFastLoading = false;
        this.upgradeError = 'Could not initiate payment. Please try again.';
      }
    });
  }
}
