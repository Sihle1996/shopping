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

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.fetchInventory();
  }

  fetchInventory(): void {
    this.adminService.getMenuItems().subscribe({
      next: data => this.inventory = data,
      error: err => console.error('Failed to fetch inventory', err)
    });
  }

  isLowStock(item: any): boolean {
    return item.stock <= item.lowStockThreshold;
  }

  adjust(item: any): void {
    const adjustment = [{ menuItemId: item.id, stockChange: item.adjustStock || 0, reservedChange: 0 }];
    this.adminService.adjustInventory(adjustment).subscribe({
      next: () => this.fetchInventory(),
      error: err => console.error('Failed to adjust inventory', err)
    });
  }

  exportCsv(): void {
    this.adminService.exportInventoryCsv().subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'inventory.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: err => console.error('Failed to export CSV', err)
    });
  }

  loadAudit(): void {
    this.adminService.getInventoryAuditLogs().subscribe({
      next: data => this.auditLog = data,
      error: err => console.error('Failed to load audit log', err)
    });
  }
}
