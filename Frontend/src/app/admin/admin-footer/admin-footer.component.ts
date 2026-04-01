import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-footer',
  templateUrl: './admin-footer.component.html',
  styleUrls: ['./admin-footer.component.scss']
})
export class AdminFooterComponent {
  navItems = [
    { route: '/admin/dashboard', label: 'Dashboard', icon: 'bi bi-grid', exact: true },
    { route: '/admin/orders', label: 'Orders', icon: 'bi bi-receipt', exact: false },
    { route: '/admin/menu', label: 'Menu', icon: 'bi bi-journal-text', exact: false },
    { route: '/admin/inventory', label: 'Inventory', icon: 'bi bi-box-seam', exact: false },
    { route: '/admin/promotions', label: 'Promos', icon: 'bi bi-tag', exact: false },
    { route: '/admin/drivers', label: 'Drivers', icon: 'bi bi-truck', exact: false },
    { route: '/admin/settings', label: 'Settings', icon: 'bi bi-gear', exact: false },
    { route: '/admin/subscription', label: 'Plan', icon: 'bi bi-credit-card-2-front', exact: false },
    { route: '/admin/users', label: 'Users', icon: 'bi bi-people', exact: false },
  ];
}
