import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { LoadersModule } from './loaders/loaders.module';
import { PaginationComponent } from '../components/pagination/pagination.component';
import { PromotionBannerComponent } from '../components/promotions/promotion-banner/promotion-banner.component';
import { PromotionGridComponent } from '../components/promotions/promotion-grid/promotion-grid.component';

@NgModule({
  // Declare non-standalone components here
  declarations: [
    PaginationComponent,
    PromotionBannerComponent,
    PromotionGridComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LoadersModule,       // NgModule stays in imports
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LoadersModule,       // re-export the NgModule
    PaginationComponent, // re-export the declared component
    PromotionBannerComponent,
    PromotionGridComponent,
  ],
})
export class SharedModule {}
