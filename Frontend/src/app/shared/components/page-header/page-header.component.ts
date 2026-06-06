import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

/**
 * Standard page header: short title + concise subtitle, with an optional
 * actions area. Responsive by construction — the title block and actions stack
 * on mobile and sit side-by-side from `sm` up, so action buttons never overflow
 * or get clipped on small screens.
 *
 *   <app-page-header title="Inventory" subtitle="Track stock and adjust prices">
 *     <button actions>Import</button>
 *   </app-page-header>
 *
 * Use `titleSuffix` for a chip/badge next to the title (e.g. an unread count).
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="font-heading text-2xl font-bold text-textDark">{{ title }}</h1>
          <ng-content select="[titleSuffix]"></ng-content>
        </div>
        <p *ngIf="subtitle" class="text-textLight text-sm mt-1">{{ subtitle }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2 empty:hidden">
        <ng-content select="[actions]"></ng-content>
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
