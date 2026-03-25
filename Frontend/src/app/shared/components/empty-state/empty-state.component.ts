import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  styles: [`:host { display: block; }`],
  template: `
    <div class="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div class="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <i [class]="icon + ' text-3xl text-textMuted'"></i>
      </div>
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
