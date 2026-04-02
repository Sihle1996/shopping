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
import { AdminPromotionsComponent } from './admin-promotions/admin-promotions.component';
import { AdminSettingsComponent } from './admin-settings/admin-settings.component';
import { AdminSubscriptionComponent } from './admin-subscription/admin-subscription.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminReviewsComponent } from './admin-reviews/admin-reviews.component';

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
      { path: 'promotions', component: AdminPromotionsComponent },
      { path: 'settings', component: AdminSettingsComponent },
      { path: 'diagnostics', component: AdminDiagnosticsComponent },
      { path: 'subscription', component: AdminSubscriptionComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'reviews', component: AdminReviewsComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}
