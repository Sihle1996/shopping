import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-footer',
  templateUrl: './admin-footer.component.html',
  styleUrls: ['./admin-footer.component.scss']
})
export class AdminFooterComponent {
  moreOpen = false;

  moreItems = [
    { route: '/admin/inventory',    label: 'Inventory',  icon: 'ph ph-package' },
    { route: '/admin/promotions',   label: 'Promos',     icon: 'ph ph-tag' },
    { route: '/admin/settings',     label: 'Settings',   icon: 'ph ph-gear-six' },
    { route: '/admin/subscription', label: 'Plan',       icon: 'ph ph-credit-card' },
    { route: '/admin/users',        label: 'Users',      icon: 'ph ph-users' },
    { route: '/admin/reviews',  label: 'Reviews', icon: 'ph ph-star' },
    { route: '/admin/support', label: 'Support', icon: 'ph ph-headset' },
    { route: '/admin/payouts', label: 'Payouts', icon: 'ph ph-wallet' },
  ];
}
