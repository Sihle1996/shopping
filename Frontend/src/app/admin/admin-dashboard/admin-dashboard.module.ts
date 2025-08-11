import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminNotificationsComponent } from '../admin-notifications/admin-notifications.component';

@NgModule({
  declarations: [AdminDashboardComponent, AdminNotificationsComponent],
  imports: [CommonModule, FormsModule],
  exports: [AdminDashboardComponent]
})
export class AdminDashboardModule {}
