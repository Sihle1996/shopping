import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  styles: [`:host { display: block; }`],
  template: `
    <div class="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <app-brand-mark face="hidden" [size]="58" class="mb-4"></app-brand-mark>
      <h3 class="font-heading text-lg font-semibold text-textDark mb-1">{{ title }}</h3>
      <p class="text-textLight text-sm mb-6 max-w-xs">{{ message }}</p>
      <app-button
        *ngIf="actionLabel"
        variant="primary"
        size="md"
        (clicked)="action.emit()">
        {{ actionLabel }}
      </app-button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  @Input() icon = 'bi bi-inbox';
  @Input() title = 'Nothing here';
  @Input() message = '';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();
}
