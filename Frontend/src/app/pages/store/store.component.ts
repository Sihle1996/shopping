import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantService, Tenant } from 'src/app/services/tenant.service';

@Component({
  selector: 'app-store',
  templateUrl: './store.component.html',
  styleUrls: ['./store.component.scss']
})
export class StoreComponent implements OnInit {
  tenant: Tenant | null = null;
  isLoading = true;
  notFound = false;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private tenantService: TenantService
  ) {}

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.router.navigate(['/']);
      return;
    }

    this.tenantService.getTenantBySlug(slug).subscribe({
      next: (tenant) => {
        this.tenant = tenant;
        // Set tenant context so interceptor sends X-Tenant-Id
        localStorage.setItem('tenantId', tenant.id);
        localStorage.setItem('storeName', tenant.name);
        this.tenantService.setCurrentTenant(tenant);
        this.isLoading = false;
      },
      error: () => {
        this.notFound = true;
        this.isLoading = false;
      }
    });
  }
}
