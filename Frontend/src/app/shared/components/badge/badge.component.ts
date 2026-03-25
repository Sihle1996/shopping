import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
export type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'app-badge',
  template: `
    <span [class]="badgeClasses">
      <ng-content></ng-content>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BadgeComponent {
  @Input() variant: BadgeVariant = 'primary';
  @Input() size: BadgeSize = 'sm';

  get badgeClasses(): string {
    const base = 'inline-flex items-center font-semibold rounded-full';

    const variants: Record<BadgeVariant, string> = {
      primary: 'bg-primary-100 text-primary-700',
      success: 'bg-green-100 text-green-700',
      warning: 'bg-yellow-100 text-yellow-700',
      danger: 'bg-red-100 text-red-700',
      neutral: 'bg-gray-100 text-gray-700',
    };

    const sizes: Record<BadgeSize, string> = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-3 py-1 text-sm',
    };

    return `${base} ${variants[this.variant]} ${sizes[this.size]}`;
  }
}
