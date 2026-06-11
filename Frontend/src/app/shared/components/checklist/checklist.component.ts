import { Component, Input } from '@angular/core';

/** One row in a {@link ChecklistComponent}. `route`/`queryParams` make the CTA navigate. */
export interface ChecklistItem {
  title: string;
  description?: string;
  done: boolean;
  required?: boolean;
  ctaLabel?: string;
  route?: string;
  queryParams?: Record<string, any>;
}

/**
 * Reusable setup/progress checklist — a status glyph + title + instruction + a navigation CTA per item.
 * Pure presentation: the host supplies the items (their done state + routes); this owns no logic.
 */
@Component({
  selector: 'app-checklist',
  templateUrl: './checklist.component.html',
})
export class ChecklistComponent {
  @Input() items: ChecklistItem[] = [];
  @Input() title = '';
  @Input() subtitle = '';

  get doneCount(): number { return this.items.filter(i => i.done).length; }
}
