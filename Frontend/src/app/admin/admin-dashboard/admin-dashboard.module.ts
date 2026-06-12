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
import { AdminActivityComponent } from '../admin-activity/admin-activity.component';
import { AdminDriverMapComponent } from '../admin-drivers/admin-driver-map.component';
import { AdminFooterComponent } from '../admin-footer/admin-footer.component';
import { AdminDiagnosticsComponent } from '../admin-diagnostics/admin-diagnostics.component';
import { InventoryManagementComponent } from '../inventory-management/inventory-management.component';
import { AdminLayoutComponent } from '../admin-layout/admin-layout.component';
import { StoreCopilotComponent } from '../store-copilot/store-copilot.component';
import { StoreAlertsComponent } from '../store-copilot/store-alerts.component';
import { AiFormatPipe } from '../store-copilot/ai-format.pipe';
import { SharedModule } from '../../shared/shared.module';
import { AdminRoutingModule } from '../admin-routing.module';
import { AdminPromotionsComponent } from '../admin-promotions/admin-promotions.component';
import { AdminSettingsComponent } from '../admin-settings/admin-settings.component';
import { AdminSubscriptionComponent } from '../admin-subscription/admin-subscription.component';
import { AdminUsersComponent } from '../admin-users/admin-users.component';
import { AdminReviewsComponent } from '../admin-reviews/admin-reviews.component';
import { AdminEnrollmentComponent } from '../admin-enrollment/admin-enrollment.component';
import { AdminSupportComponent } from '../admin-support/admin-support.component';
import { AdminPayoutsComponent } from '../admin-payouts/admin-payouts.component';
import { AdminBooksComponent } from '../admin-books/admin-books.component';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';
import { ConfidenceMeterComponent } from '../../shared/components/confidence-meter/confidence-meter.component';
import { DeltaBarComponent } from '../../shared/components/delta-bar/delta-bar.component';

@NgModule({
  declarations: [
    AdminDashboardComponent,
    AdminNotificationsComponent,
    AdminOrdersComponent,
    AdminMenuComponent,
    AdminDriversComponent,
    AdminActivityComponent,
    AdminDriverMapComponent,
    AdminFooterComponent,
    AdminDiagnosticsComponent,
    InventoryManagementComponent,
    AdminLayoutComponent,
    StoreCopilotComponent,
    StoreAlertsComponent,
    AiFormatPipe,
    AdminPromotionsComponent,
    AdminSettingsComponent,
    AdminSubscriptionComponent,
    AdminUsersComponent,
    AdminReviewsComponent,
    AdminEnrollmentComponent,
    AdminSupportComponent,
    AdminPayoutsComponent,
    AdminBooksComponent,
  ],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule, AdminRoutingModule, NgApexchartsModule,
    BrandMarkComponent, ConfidenceMeterComponent, DeltaBarComponent],
  exports: [AdminDashboardComponent, AdminFooterComponent],
})
export class AdminDashboardModule {}
