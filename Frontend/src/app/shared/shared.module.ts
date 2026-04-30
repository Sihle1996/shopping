import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { LoadersModule } from './loaders/loaders.module';
import { PaginationComponent } from '../components/pagination/pagination.component';
import { PromotionBannerComponent } from '../components/promotions/promotion-banner/promotion-banner.component';
import { PromotionGridComponent } from '../components/promotions/promotion-grid/promotion-grid.component';

// Shared reusable components
import { ButtonComponent } from './components/button/button.component';
import { BadgeComponent } from './components/badge/badge.component';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { CategoryChipsComponent } from './components/category-chips/category-chips.component';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { QuantitySelectorComponent } from './components/quantity-selector/quantity-selector.component';
import { EmptyStateComponent } from './components/empty-state/empty-state.component';
import { CartDrawerComponent } from './components/cart-drawer/cart-drawer.component';
import { FloatingCartBarComponent } from './components/floating-cart-bar/floating-cart-bar.component';
import { ConfirmModalComponent } from './components/confirm-modal/confirm-modal.component';
import { IntentChipsComponent } from './components/intent-chips/intent-chips.component';
import { OrderAssistantComponent } from './components/order-assistant/order-assistant.component';

@NgModule({
  declarations: [
    PaginationComponent,
    PromotionBannerComponent,
    PromotionGridComponent,
    // Shared UI components
    ButtonComponent,
    BadgeComponent,
    ProductCardComponent,
    CategoryChipsComponent,
    SearchBarComponent,
    QuantitySelectorComponent,
    EmptyStateComponent,
    CartDrawerComponent,
    FloatingCartBarComponent,
    ConfirmModalComponent,
    IntentChipsComponent,
    OrderAssistantComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LoadersModule,
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LoadersModule,
    PaginationComponent,
    PromotionBannerComponent,
    PromotionGridComponent,
    // Shared UI components
    ButtonComponent,
    BadgeComponent,
    ProductCardComponent,
    CategoryChipsComponent,
    SearchBarComponent,
    QuantitySelectorComponent,
    EmptyStateComponent,
    CartDrawerComponent,
    FloatingCartBarComponent,
    ConfirmModalComponent,
    IntentChipsComponent,
    OrderAssistantComponent,
  ],
})
export class SharedModule {}
