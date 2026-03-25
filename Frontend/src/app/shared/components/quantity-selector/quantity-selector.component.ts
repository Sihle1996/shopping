import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-quantity-selector',
  template: `
    <div class="flex items-center gap-3">
      <button
        type="button"
        (click)="decrease()"
        [disabled]="quantity <= min"
        class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-textDark transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-90">
        <i class="bi bi-dash text-lg"></i>
      </button>
      <span class="font-numbers font-semibold text-base min-w-[24px] text-center select-none">
        {{ quantity }}
      </span>
      <button
        type="button"
        (click)="increase()"
        [disabled]="quantity >= max"
        class="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-90">
        <i class="bi bi-plus text-lg"></i>
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuantitySelectorComponent {
  @Input() quantity = 1;
  @Input() min = 1;
  @Input() max = 99;
  @Output() quantityChange = new EventEmitter<number>();

  increase(): void {
    if (this.quantity < this.max) {
      this.quantity++;
      this.quantityChange.emit(this.quantity);
    }
  }

  decrease(): void {
    if (this.quantity > this.min) {
      this.quantity--;
      this.quantityChange.emit(this.quantity);
    }
  }
}
