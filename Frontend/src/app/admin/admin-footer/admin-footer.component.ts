import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-footer',
  templateUrl: './admin-footer.component.html',
  styleUrls: ['./admin-footer.component.scss']
})
export class AdminFooterComponent {
  moreOpen = false;

  moreItems = [
    { route: '/admin/inventory',    label: 'Inventory',  icon: 'bi bi-box-seam' },
    { route: '/admin/promotions',   label: 'Promos',     icon: 'bi bi-tag' },
    { route: '/admin/settings',     label: 'Settings',   icon: 'bi bi-gear' },
    { route: '/admin/subscription', label: 'Plan',       icon: 'bi bi-credit-card-2-front' },
    { route: '/admin/users',        label: 'Users',      icon: 'bi bi-people' },
    { route: '/admin/reviews',  label: 'Reviews', icon: 'bi bi-star' },
    { route: '/admin/support', label: 'Support', icon: 'bi bi-headset' },
    { route: '/admin/payouts', label: 'Payouts', icon: 'bi bi-wallet2' },
  ];
}
