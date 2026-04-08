import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-superadmin-layout',
  templateUrl: './superadmin-layout.component.html',
  styleUrls: ['./superadmin-layout.component.scss']
})
export class SuperadminLayoutComponent {
  sidebarOpen = false;

  navLinks = [
    { label: 'Dashboard',     icon: 'bi-grid-1x2',   route: '/superadmin/dashboard' },
    { label: 'Stores',        icon: 'bi-shop',        route: '/superadmin/stores' },
    { label: 'Subscriptions', icon: 'bi-credit-card', route: '/superadmin/subscriptions' },
  ];

  constructor(private auth: AuthService, private router: Router) {}

  logout(): void {
    this.auth.logout();
  }
}
