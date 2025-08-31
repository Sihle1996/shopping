import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminNotificationsComponent } from '../admin-notifications/admin-notifications.component';
import { AdminRoutingModule } from '../admin-routing.module';

@NgModule({
  declarations: [AdminDashboardComponent, AdminNotificationsComponent],
  imports: [CommonModule, FormsModule, AdminRoutingModule],
  exports: [AdminDashboardComponent]
})
export class AdminDashboardModule {}
