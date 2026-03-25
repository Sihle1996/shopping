import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { environment } from 'src/environments/environment';

export interface ProductCardItem {
  id: number | null;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isAvailable: boolean;
}

@Component({
  selector: 'app-product-card',
  template: `
    <div
      class="group bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover
             transition-all duration-300 cursor-pointer animate-fade-in"
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
        <!-- Unavailable overlay -->
        <div *ngIf="!item.isAvailable"
             class="absolute inset-0 bg-black/40 flex items-center justify-center">
          <span class="text-white font-semibold text-sm bg-black/60 px-3 py-1 rounded-full">Out of Stock</span>
        </div>
        <!-- Favorite button -->
        <button
          *ngIf="showFavorite"
          (click)="onFavorite($event)"
          class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm
                 flex items-center justify-center shadow-sm
                 hover:bg-red-50 hover:text-danger transition-all duration-200 active:scale-90">
          <i class="bi bi-heart text-base"></i>
        </button>
      </div>
      <!-- Content -->
      <div class="p-4">
        <h4 class="font-semibold text-textDark text-base truncate mb-1">{{ item.name }}</h4>
        <p class="text-textLight text-sm line-clamp-2 mb-3 leading-relaxed">{{ item.description }}</p>
        <div class="flex items-center justify-between">
          <span class="font-numbers font-bold text-lg text-primary">
            R{{ item.price.toFixed(2) }}
          </span>
          <button
            *ngIf="showAddToCart && item.isAvailable"
            (click)="onAddToCart($event)"
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
