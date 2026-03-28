import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SuperadminLayoutComponent } from './superadmin-layout/superadmin-layout.component';
import { SuperadminDashboardComponent } from './superadmin-dashboard/superadmin-dashboard.component';
import { SuperadminStoresComponent } from './superadmin-stores/superadmin-stores.component';

const routes: Routes = [
  {
    path: '',
    component: SuperadminLayoutComponent,
    children: [
      { path: 'dashboard', component: SuperadminDashboardComponent },
      { path: 'stores',    component: SuperadminStoresComponent },
      { path: '',          redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SuperadminRoutingModule {}
