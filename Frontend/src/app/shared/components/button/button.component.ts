import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [class]="buttonClasses"
      (click)="handleClick($event)">
      <!-- Loading spinner -->
      <svg *ngIf="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <!-- Icon left -->
      <i *ngIf="iconLeft && !loading" [class]="iconLeft + ' mr-2'"></i>
      <!-- Content -->
      <ng-content></ng-content>
      <!-- Icon right -->
      <i *ngIf="iconRight" [class]="iconRight + ' ml-2'"></i>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() fullWidth = false;
  @Input() rounded = false;
  @Input() iconLeft = '';
  @Input() iconRight = '';

  @Output() clicked = new EventEmitter<MouseEvent>();

  handleClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }

  get buttonClasses(): string {
    const base = 'inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

    const variants: Record<ButtonVariant, string> = {
      primary: 'bg-primary text-white hover:bg-primary-600 focus:ring-primary-400 shadow-sm hover:shadow-md',
      secondary: 'bg-primary-100 text-primary-700 hover:bg-primary-200 focus:ring-primary-300',
      outline: 'border-2 border-primary text-primary hover:bg-primary-50 focus:ring-primary-300',
      ghost: 'text-textDark hover:bg-gray-100 focus:ring-gray-300',
      danger: 'bg-danger text-white hover:bg-red-600 focus:ring-red-400 shadow-sm',
    };

    const sizes: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm gap-1',
      md: 'px-5 py-2.5 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2',
    };

    const width = this.fullWidth ? 'w-full' : '';
    const radius = this.rounded ? 'rounded-full' : 'rounded-lg';

    return `${base} ${variants[this.variant]} ${sizes[this.size]} ${width} ${radius}`;
  }
}
