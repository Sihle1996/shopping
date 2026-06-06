import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../shared/shared.module';
import { DriverRoutingModule } from './driver-routing.module';
import { DriverDashboardComponent } from './driver-dashboard/driver-dashboard.component';
import { DriverMapComponent } from './driver-map/driver-map.component';
import { DriverProfileComponent } from './driver-profile/driver-profile.component';

@NgModule({
  declarations: [
    DriverDashboardComponent,
    DriverMapComponent,
    DriverProfileComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule,
    DriverRoutingModule,
  ],
})
export class DriverModule {}
