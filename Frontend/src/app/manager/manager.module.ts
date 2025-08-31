import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ManagerDashboardComponent } from './manager-dashboard/manager-dashboard.component';
import { ManagerRoutingModule } from './manager-routing.module';

@NgModule({
  declarations: [ManagerDashboardComponent],
  imports: [CommonModule, ManagerRoutingModule],
  exports: [ManagerDashboardComponent]
})
export class ManagerModule {}
