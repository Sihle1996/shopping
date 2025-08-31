import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminNotificationsComponent } from '../admin-notifications/admin-notifications.component';
import { AdminOrdersComponent } from '../admin-orders/admin-orders.component';
import { AdminMenuComponent } from '../admin-menu/admin-menu.component';
import { AdminDriversComponent } from '../admin-drivers/admin-drivers.component';
import { AdminDriverMapComponent } from '../admin-drivers/admin-driver-map.component';
import { AdminFooterComponent } from '../admin-footer/admin-footer.component';
import { AdminDiagnosticsComponent } from '../admin-diagnostics/admin-diagnostics.component';
import { InventoryManagementComponent } from '../inventory-management/inventory-management.component';
import { DriverDashboardComponent } from '../../driver/driver-dashboard/driver-dashboard.component';
import { DriverMapComponent } from '../../driver/driver-map/driver-map.component';
import { ManagerDashboardComponent } from '../../manager/manager-dashboard/manager-dashboard.component';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { SharedModule } from '../../shared/shared.module';
import { AdminRoutingModule } from '../admin-routing.module';

@NgModule({
  declarations: [
    AdminDashboardComponent,
    AdminNotificationsComponent,
    AdminOrdersComponent,
    AdminMenuComponent,
    AdminDriversComponent,
    AdminDriverMapComponent,
    AdminFooterComponent,
    AdminDiagnosticsComponent,
    InventoryManagementComponent,
    DriverDashboardComponent,
    DriverMapComponent,
    ManagerDashboardComponent,
    AdminLayoutComponent,
  ],
  imports: [CommonModule, FormsModule, RouterModule, SharedModule, AdminRoutingModule],
  exports: [AdminDashboardComponent, AdminFooterComponent],
})
export class AdminDashboardModule {}

