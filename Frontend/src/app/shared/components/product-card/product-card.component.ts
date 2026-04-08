import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { environment } from 'src/environments/environment';

export interface ProductCardItem {
  id: string | null;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isAvailable: boolean;
  stock?: number;
  lowStockThreshold?: number;
}

@Component({
  selector: 'app-product-card',
  template: `
    <div
      class="group bg-white rounded-2xl overflow-hidden brand-trim shadow-card hover:shadow-card-hover
             transition-all duration-300 cursor-pointer animate-fade-in"
      data-testid="product-card"
      (click)="cardClick.emit(item)">
      <!-- Image -->
      <div class="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          [src]="getImageUrl(item.image)"
          [alt]="item.name"
          loading="lazy"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <!-- Category Badge -->
        <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 text-textDark backdrop-blur-sm">
          {{ item.category }}
        </span>
        <!-- Low stock badge -->
        <span *ngIf="isLowStock"
              class="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/90 text-white">
          Only {{ item.stock }} left
        </span>
        <!-- Unavailable overlay -->
        <div *ngIf="!item.isAvailable"
             class="absolute inset-0 bg-black/40 flex items-center justify-center">
          <span class="text-white font-semibold text-sm bg-black/60 px-3 py-1 rounded-full">Out of Stock</span>
        </div>
      </div>
      <!-- Content -->
      <div class="p-4">
        <h4 class="font-semibold text-textDark text-base truncate mb-1">{{ item.name }}</h4>
        <p class="text-textLight text-sm line-clamp-2 mb-3 leading-relaxed">{{ item.description }}</p>
        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <span *ngIf="discountPercent" class="font-numbers text-xs text-textLight line-through leading-none">
              R{{ item.price.toFixed(2) }}
            </span>
            <span class="font-numbers font-bold text-lg text-primary leading-tight">
              R{{ discountedPrice.toFixed(2) }}
            </span>
          </div>
          <button
            *ngIf="showAddToCart && item.isAvailable"
            (click)="onAddToCart($event)"
            data-testid="add-to-cart-btn"
            class="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center
                   hover:bg-primary-600 transition-all duration-200 active:scale-90 shadow-sm">
            <i class="bi bi-plus-lg text-base"></i>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardComponent {
  @Input() item!: ProductCardItem;
  @Input() showFavorite = false;
  @Input() showAddToCart = true;
  @Input() discountPercent = 0;

  get isLowStock(): boolean {
    const s = this.item?.stock;
    const t = this.item?.lowStockThreshold ?? 5;
    return s != null && s > 0 && s <= t;
  }

  get discountedPrice(): number {
    if (!this.item) return 0;
    if (!this.discountPercent) return this.item.price;
    return this.item.price * (1 - this.discountPercent / 100);
  }
  @Output() cardClick = new EventEmitter<ProductCardItem>();
  @Output() addToCart = new EventEmitter<ProductCardItem>();
  @Output() favorite = new EventEmitter<ProductCardItem>();

  getImageUrl(path: string | null): string {
    if (!path) return 'assets/placeholder.png';
    return path.startsWith('http') ? path : `${environment.apiUrl}${path}`;
  }

  onAddToCart(event: MouseEvent): void {
    event.stopPropagation();
    this.addToCart.emit(this.item);
  }

  onFavorite(event: MouseEvent): void {
    event.stopPropagation();
    this.favorite.emit(this.item);
  }
}
