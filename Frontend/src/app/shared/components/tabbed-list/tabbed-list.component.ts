import { Component, EventEmitter, Input, Output } from '@angular/core';

/** One segment in a {@link TabbedListComponent}. `count` is an optional badge (omit for none). */
export interface TabItem {
  key: string;
  label: string;
  count?: number | null;
  disabled?: boolean;
}

/**
 * Shared segmented-tab bar for filtering a list (Orders, Reviews, Support, Promotions, …). Horizontally
 * scrollable so it never breaks on mobile with many tabs. Navigation ONLY — it emits the selected key
 * and the host does the filtering; it owns no business logic and depends on no other primitive.
 */
@Component({
  selector: 'app-tabbed-list',
  templateUrl: './tabbed-list.component.html',
})
export class TabbedListComponent {
  @Input() tabs: TabItem[] = [];
  @Input() selected = '';
  @Output() select = new EventEmitter<string>();

  onSelect(key: string): void {
    if (key !== this.selected) this.select.emit(key);
  }
}
