import { NgApexchartsModule } from 'ng-apexcharts';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { DriverProfileComponent } from '../../driver/driver-profile/driver-profile.component';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { SharedModule } from '../../shared/shared.module';
import { AdminRoutingModule } from '../admin-routing.module';
import { AdminPromotionsComponent } from '../admin-promotions/admin-promotions.component';
import { AdminSettingsComponent } from '../admin-settings/admin-settings.component';
import { AdminSubscriptionComponent } from '../admin-subscription/admin-subscription.component';
import { AdminUsersComponent } from '../admin-users/admin-users.component';
import { AdminReviewsComponent } from '../admin-reviews/admin-reviews.component';

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
    DriverProfileComponent,
    AdminLayoutComponent,
    AdminPromotionsComponent,
    AdminSettingsComponent,
    AdminSubscriptionComponent,
    AdminUsersComponent,
    AdminReviewsComponent,
  ],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule, AdminRoutingModule, NgApexchartsModule],
  exports: [AdminDashboardComponent, AdminFooterComponent],
})
export class AdminDashboardModule {}
