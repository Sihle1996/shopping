import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, filter, takeUntil } from 'rxjs/operators';
import { AdminService } from 'src/app/services/admin.service';
import { SubscriptionService } from 'src/app/services/subscription.service';
import { NotificationService } from 'src/app/services/notification.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-inventory-management',
  templateUrl: './inventory-management.component.html',
  styleUrls: ['./inventory-management.component.scss']
})
export class InventoryManagementComponent implements OnInit, OnDestroy {
  inventory: any[] = [];
  auditLog: any[] = [];
  auditLogLimit = 20;
  searchTerm = '';
  lowStockOnly = false;
  showAudit = false;

  hasInventoryExport = false;
  subscriptionPlan = '';
  adjustingId: string | null = null;
  togglingId: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private adminService: AdminService,
    private subscriptionService: SubscriptionService,
    private notificationService: NotificationService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.fetchInventory();
    this.subscriptionService.load().subscribe(info => {
      this.hasInventoryExport = info.features.hasInventoryExport;
      this.subscriptionPlan = info.plan;
    });
    this.notificationService.orderEvents
      .pipe(
        filter(e => e.type === 'ORDER_CREATED' || e.type === 'ORDER_CANCELLED'),
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.fetchInventory());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchInventory(): void {
    // Use the service's loader which fetches menu items and updates the
    // internal observable state. Explicit typing avoids the implicit `any`
    // errors flagged by the TypeScript compiler.
    this.adminService.loadMenuItems().subscribe({
      next: (data: any[]) => (this.inventory = data),
      error: () => {}
    });
  }

  isLowStock(item: any): boolean {
    return item.stock <= item.lowStockThreshold;
  }

  get filteredInventory(): any[] {
    return this.inventory
      .filter(item => {
        const matchesName = item.name.toLowerCase().includes(this.searchTerm.toLowerCase());
        const matchesLowStock = !this.lowStockOnly || this.isLowStock(item);
        return matchesName && matchesLowStock;
      })
      .sort((a, b) => {
        if (this.sortBy === 'stock') return b.stock - a.stock;
        if (this.sortBy === 'reserved') return b.reservedStock - a.reservedStock;
        return a.name.localeCompare(b.name);
      });
  }

  adjust(item: any): void {
    const adjustment = [{
      menuItemId: item.id,
      stockChange: item.adjustStock || 0,
      reservedChange: 0,
      lowStockThreshold: item.lowStockThreshold ?? 5
    }];
    this.adjustingId = item.id;
    this.adminService.adjustInventory(adjustment).subscribe({
      next: () => {
        item.adjustStock = 0;
        this.adjustingId = null;
        this.toastr.success('Stock updated');
        this.fetchInventory();
      },
      error: () => {
        this.adjustingId = null;
        this.toastr.error('Failed to update stock');
      }
    });
  }

  syncing = false;

  syncAvailability(): void {
    this.syncing = true;
    this.adminService.syncAvailability().subscribe({
      next: (count) => {
        this.syncing = false;
        this.toastr.success(`Availability synced (${count} items updated)`);
        this.fetchInventory();
      },
      error: () => {
        this.syncing = false;
        this.toastr.error('Failed to sync availability');
      }
    });
  }

  toggleAvailability(item: any): void {
    const next = !item.isAvailable;
    this.togglingId = item.id;
    this.adminService.setItemAvailability(item.id, next).subscribe({
      next: () => {
        item.isAvailable = next;
        this.togglingId = null;
        this.toastr.success(next ? `${item.name} is now visible` : `${item.name} hidden from customers`);
      },
      error: () => {
        this.togglingId = null;
        this.toastr.error('Failed to update visibility');
      }
    });
  }

  exportCsv(): void {
    if (!this.hasInventoryExport) {
      this.router.navigate(['/admin/subscription']);
      return;
    }
    this.adminService.exportInventoryCsv().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'inventory.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.toastr.error('Failed to export CSV')
    });
  }

  toggleAuditGated(): void {
    if (!this.hasInventoryExport) {
      this.router.navigate(['/admin/subscription']);
      return;
    }
    this.toggleAudit();
  }

  toggleAudit(): void {
    this.showAudit = !this.showAudit;
    if (this.showAudit) {
      this.auditLogLimit = 20;
      if (!this.auditLog.length) this.loadAudit();
    }
  }

  loadAudit(): void {
    this.adminService.getInventoryAuditLogs().subscribe({
      next: (data: any[]) => (this.auditLog = data),
      error: () => {}
    });
  }

  // in your component.ts
sortBy: 'name' | 'stock' | 'reserved' = 'name';

trackById = (_: number, it: any) => it.id;

step(item: any, delta: number) {
  const current = Number(item.adjustStock ?? 0);
  item.adjustStock = current + delta;
}

stockPercent(item: any): number {
  const max = Math.max((item.lowStockThreshold ?? 10) * 2, item.stock + item.reservedStock, 1);
  return Math.min(100, Math.round((item.stock / max) * 100));
}

// KPI quickies
get lowCount(): number {
  return this.filteredInventory.filter((i: any) => this.isLowStock(i)).length;
}
get reservedSum(): number {
  return this.filteredInventory.reduce((s: number, i: any) => s + (i.reservedStock || 0), 0);
}
get stockSum(): number {
  return this.filteredInventory.reduce((s: number, i: any) => s + (i.stock || 0), 0);
}

}
