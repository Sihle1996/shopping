import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DriverDashboardComponent } from './driver-dashboard/driver-dashboard.component';
import { DriverProfileComponent } from './driver-profile/driver-profile.component';
import { DriverGuard } from '../guards/driver.guard';

const routes: Routes = [
  { path: 'dashboard', component: DriverDashboardComponent, canActivate: [DriverGuard] },
  { path: 'profile', component: DriverProfileComponent, canActivate: [DriverGuard] },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DriverRoutingModule {}
