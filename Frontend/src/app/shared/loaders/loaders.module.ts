import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GlobalSpinnerComponent } from './global-spinner/global-spinner.component';
import { TableSkeletonComponent } from './table-skeleton/table-skeleton.component';
import { ChartSkeletonComponent } from './chart-skeleton/chart-skeleton.component';
import { ButtonSpinnerComponent } from './button-spinner/button-spinner.component';

@NgModule({
  declarations: [
    GlobalSpinnerComponent,
    TableSkeletonComponent,
    ChartSkeletonComponent,
    ButtonSpinnerComponent
  ],
  imports: [CommonModule],
  exports: [
    GlobalSpinnerComponent,
    TableSkeletonComponent,
    ChartSkeletonComponent,
    ButtonSpinnerComponent
  ]
})
export class LoadersModule {}
