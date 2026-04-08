import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CartItem } from 'src/app/services/cart.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-cart-drawer',
  template: `
    <!-- Backdrop -->
    <div
      *ngIf="isOpen"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
      (click)="close.emit()">
    </div>

    <!-- Drawer -->
    <div
      class="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-float
             transform transition-transform duration-300 ease-out flex flex-col"
      [class.translate-x-0]="isOpen"
      [class.translate-x-full]="!isOpen">

      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary to-primary-600">
        <h3 class="font-heading text-lg font-bold text-white">
          Your Cart
          <span *ngIf="items.length" class="text-white/70 font-normal text-sm ml-1">({{ items.length }})</span>
        </h3>
        <button
          (click)="close.emit()"
          class="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
          <i class="bi bi-x-lg text-white"></i>
        </button>
      </div>

      <!-- Empty state -->
      <div *ngIf="items.length === 0" class="flex-1 flex items-center justify-center">
        <app-empty-state
          icon="bi bi-cart3"
          title="Your cart is empty"
          message="Browse our menu and add your favourite items"
          actionLabel="Browse Menu"
          (action)="browseMenu.emit()">
        </app-empty-state>
      </div>

      <!-- Items -->
      <div *ngIf="items.length > 0" class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div *ngFor="let item of items; trackBy: trackById"
             class="flex items-center gap-4 p-3 rounded-xl bg-surface animate-fade-in">
          <img [src]="getImageUrl(item.image)" [alt]="item.menuItemName"
               class="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <h4 class="font-semibold text-sm text-textDark truncate">{{ item.menuItemName }}</h4>
            <p class="text-textMuted text-xs mt-0.5">{{ item.size }}</p>
            <p class="font-numbers font-bold text-primary text-sm mt-1">
              R{{ (item.menuItemPrice * item.quantity).toFixed(2) }}
            </p>
          </div>
          <div class="flex flex-col items-end gap-2">
            <button
              (click)="removeItem.emit(item.id)"
              class="text-textMuted hover:text-danger transition-colors">
              <i class="bi bi-trash text-sm"></i>
            </button>
            <app-quantity-selector
              [quantity]="item.quantity"
              (quantityChange)="onQuantityChange(item, $event)">
            </app-quantity-selector>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div *ngIf="items.length > 0" class="border-t border-borderColor px-6 py-4 space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-textLight text-sm">Total</span>
          <span class="font-numbers font-bold text-xl text-textDark">R{{ totalPrice.toFixed(2) }}</span>
        </div>
        <app-button
          variant="primary"
          size="lg"
          [fullWidth]="true"
          (clicked)="checkout.emit()">
          Proceed to Checkout
        </app-button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartDrawerComponent {
  @Input() isOpen = false;
  @Input() items: CartItem[] = [];
  @Input() totalPrice = 0;
  @Output() close = new EventEmitter<void>();
  @Output() checkout = new EventEmitter<void>();
  @Output() browseMenu = new EventEmitter<void>();
  @Output() removeItem = new EventEmitter<string>();
  @Output() updateQuantity = new EventEmitter<{ item: CartItem; quantity: number }>();

  getImageUrl(path: string | null | undefined): string {
    if (!path) return 'assets/placeholder.png';
    return path.startsWith('http') ? path : `${environment.apiUrl}${path}`;
  }

  onQuantityChange(item: CartItem, quantity: number): void {
    this.updateQuantity.emit({ item, quantity });
  }

  trackById(_: number, item: CartItem): string {
    return item.id;
  }
}
