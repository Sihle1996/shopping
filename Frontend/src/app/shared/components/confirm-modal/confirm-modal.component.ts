import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  styles: [`:host { display: block; }`],
  template: `
    <!-- Backdrop -->
    <div *ngIf="isOpen" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
         (click)="onCancel()">
      <!-- Modal -->
      <div class="bg-white rounded-2xl shadow-float w-full max-w-sm p-6 animate-bounce-in"
           (click)="$event.stopPropagation()">
        <!-- Icon -->
        <div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
             [class]="iconBgClass">
          <i [class]="icon + ' text-xl ' + iconColorClass"></i>
        </div>
        <!-- Title -->
        <h3 class="font-heading text-lg font-bold text-textDark text-center mb-1">{{ title }}</h3>
        <!-- Message -->
        <p class="text-textLight text-sm text-center mb-4">{{ message }}</p>
        <!-- Optional reason / note input -->
        <textarea *ngIf="input" #reasonBox (input)="inputValue = reasonBox.value" rows="2"
                  [placeholder]="input.placeholder || 'Add a note…'"
                  class="w-full mb-5 rounded-xl border border-borderColor bg-surface px-3 py-2 text-sm text-textDark
                         focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"></textarea>
        <!-- Actions -->
        <div class="flex gap-3">
          <app-button *ngIf="showCancel" variant="ghost" size="md" [fullWidth]="true" (clicked)="onCancel()">
            {{ cancelLabel }}
          </app-button>
          <app-button [variant]="confirmVariant" size="md" [fullWidth]="true" (clicked)="onConfirm()">
            {{ confirmLabel }}
          </app-button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmModalComponent {
  @Input() isOpen = false;
  @Input() title = 'Are you sure?';
  @Input() message = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() variant: 'danger' | 'warning' | 'primary' = 'danger';
  @Input() showCancel = true;
  @Input() input: { placeholder?: string } | null = null;

  inputValue = '';

  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  get confirmVariant(): 'danger' | 'primary' {
    return this.variant === 'primary' ? 'primary' : 'danger';
  }

  get icon(): string {
    switch (this.variant) {
      case 'danger': return 'ph ph-warning';
      case 'warning': return 'ph ph-question';
      default: return 'ph ph-info';
    }
  }

  get iconBgClass(): string {
    switch (this.variant) {
      case 'danger': return 'bg-red-100';
      case 'warning': return 'bg-yellow-100';
      default: return 'bg-primary-100';
    }
  }

  get iconColorClass(): string {
    switch (this.variant) {
      case 'danger': return 'text-danger';
      case 'warning': return 'text-warning';
      default: return 'text-primary';
    }
  }

  onConfirm(): void {
    this.confirmed.emit(this.inputValue);
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
