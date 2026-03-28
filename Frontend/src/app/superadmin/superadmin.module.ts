import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SharedModule } from '../shared/shared.module';
import { SuperadminRoutingModule } from './superadmin-routing.module';

import { SuperadminLayoutComponent } from './superadmin-layout/superadmin-layout.component';
import { SuperadminDashboardComponent } from './superadmin-dashboard/superadmin-dashboard.component';
import { SuperadminStoresComponent } from './superadmin-stores/superadmin-stores.component';

@NgModule({
  declarations: [
    SuperadminLayoutComponent,
    SuperadminDashboardComponent,
    SuperadminStoresComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule,
    SuperadminRoutingModule,
  ]
})
export class SuperadminModule {}
