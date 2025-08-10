import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';
import { AdminDashboardComponent } from './admin-dashboard.component';

@NgModule({
  declarations: [AdminDashboardComponent],
  imports: [CommonModule, FormsModule, NgChartsModule],
  exports: [AdminDashboardComponent]
})
export class AdminDashboardModule {}
