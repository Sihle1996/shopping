import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/services/admin.service';

@Component({
  selector: 'app-inventory-management',
  templateUrl: './inventory-management.component.html',
  styleUrls: ['./inventory-management.component.scss']
})
export class InventoryManagementComponent implements OnInit {
  inventory: any[] = [];
  auditLog: any[] = [];
  searchTerm = '';
  lowStockOnly = false;
  showAudit = false;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.fetchInventory();
  }

  fetchInventory(): void {
    // Use the service's loader which fetches menu items and updates the
    // internal observable state. Explicit typing avoids the implicit `any`
    // errors flagged by the TypeScript compiler.
    this.adminService.loadMenuItems().subscribe({
      next: (data: any[]) => (this.inventory = data),
      error: (err: unknown) => console.error('Failed to fetch inventory', err)
    });
  }

  isLowStock(item: any): boolean {
    return item.stock <= item.lowStockThreshold;
  }

  get filteredInventory(): any[] {
    return this.inventory.filter((item) => {
      const matchesName = item.name
        .toLowerCase()
        .includes(this.searchTerm.toLowerCase());
      const matchesLowStock = !this.lowStockOnly || this.isLowStock(item);
      return matchesName && matchesLowStock;
    });
  }

  adjust(item: any): void {
    const adjustment = [{ menuItemId: item.id, stockChange: item.adjustStock || 0, reservedChange: 0 }];
    this.adminService.adjustInventory(adjustment).subscribe({
      next: () => this.fetchInventory(),
      error: (err: unknown) => console.error('Failed to adjust inventory', err)
    });
  }

  exportCsv(): void {
    this.adminService.exportInventoryCsv().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'inventory.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err: unknown) => console.error('Failed to export CSV', err)
    });
  }

  toggleAudit(): void {
    this.showAudit = !this.showAudit;
    if (this.showAudit && !this.auditLog.length) {
      this.loadAudit();
    }
  }

  loadAudit(): void {
    this.adminService.getInventoryAuditLogs().subscribe({
      next: (data: any[]) => (this.auditLog = data),
      error: (err: unknown) => console.error('Failed to load audit log', err)
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
