import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { TenantService, Tenant } from 'src/app/services/tenant.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  menuOpen = false;
  isLoggedIn = false;
  userRole: string | null = null;
  storeName: string | null = null;

  constructor(
    private authService: AuthService,
    private tenantService: TenantService,
    private router: Router
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.userRole = this.authService.getUserRole();
    this.loadTenantName();
  }

  private loadTenantName(): void {
    const tenantId = this.authService.getTenantId();
    if (tenantId) {
      this.tenantService.currentTenant$.subscribe(tenant => {
        if (tenant) {
          this.storeName = tenant.name;
        }
      });
    }
    // Also check localStorage as fallback
    const name = localStorage.getItem('storeName');
    if (name) this.storeName = name;
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  logout() {
    this.authService.logout();
    localStorage.removeItem('storeName');
    this.isLoggedIn = false;
    this.storeName = null;
    this.toggleMenu();
    this.router.navigate(['/login']);
  }
}
