import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { AdminOrdersComponent } from './admin-orders/admin-orders.component';
import { AdminMenuComponent } from './admin-menu/admin-menu.component';
import { AdminDriversComponent } from './admin-drivers/admin-drivers.component';
import { InventoryManagementComponent } from './inventory-management/inventory-management.component';
import { AdminDiagnosticsComponent } from './admin-diagnostics/admin-diagnostics.component';
import { AdminGuard } from '../guards/admin.guard';

const routes: Routes = [
  {
    path: 'admin',
    canActivate: [AdminGuard],
    component: AdminLayoutComponent,
    children: [
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'orders', component: AdminOrdersComponent },
      { path: 'menu', component: AdminMenuComponent },
      { path: 'drivers', component: AdminDriversComponent },
      { path: 'inventory', component: InventoryManagementComponent },
      { path: 'diagnostics', component: AdminDiagnosticsComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}
