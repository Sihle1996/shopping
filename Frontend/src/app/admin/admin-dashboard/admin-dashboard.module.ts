import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminNotificationsComponent } from '../admin-notifications/admin-notifications.component';

@NgModule({
  declarations: [AdminDashboardComponent, AdminNotificationsComponent],
  imports: [SharedModule],
  exports: [AdminDashboardComponent]
})
export class AdminDashboardModule {}
