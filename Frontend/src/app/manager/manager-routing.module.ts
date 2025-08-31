import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ManagerDashboardComponent } from './manager-dashboard/manager-dashboard.component';
import { ManagerGuard } from '../guards/manager.guard';

const routes: Routes = [
  {
    path: 'manager',
    canActivate: [ManagerGuard],
    children: [
      { path: 'dashboard', component: ManagerDashboardComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ManagerRoutingModule {}
