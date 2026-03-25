import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-floating-cart-bar',
  template: `
    <div
      *ngIf="itemCount > 0"
      (click)="openCart.emit()"
      class="fixed bottom-20 left-4 right-4 z-40 bg-primary text-white
             px-6 py-3.5 rounded-2xl shadow-float
             flex items-center justify-between cursor-pointer
             hover:bg-primary-600 transition-all duration-300
             animate-slide-up lg:hidden">
      <div class="flex items-center gap-3">
        <div class="relative">
          <i class="bi bi-cart3 text-xl"></i>
          <span class="absolute -top-2 -right-2 w-5 h-5 bg-white text-primary text-xs font-bold
                       rounded-full flex items-center justify-center">
            {{ itemCount }}
          </span>
        </div>
        <span class="font-semibold text-sm">View Cart</span>
      </div>
      <span class="font-numbers font-bold">R{{ totalPrice.toFixed(2) }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FloatingCartBarComponent {
  @Input() itemCount = 0;
  @Input() totalPrice = 0;
  @Output() openCart = new EventEmitter<void>();
}
