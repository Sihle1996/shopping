import { Component, Input } from '@angular/core';
import { LIST_PAGE_SIZE } from '../../pipes/paginate.pipe';

/**
 * Reusable client-side pagination wrapper — owns the page state, slicing, and the <app-pagination>
 * control so list pages don't each re-wire page/pageSize/totalPages. Keeps the visible list short
 * enough to fit the screen without scrolling (shared {@link LIST_PAGE_SIZE}).
 *
 * Usage — project your list and iterate `pl.pageItems`:
 *   <app-paged-list [items]="filteredThings" #pl>
 *     <div *ngFor="let t of pl.pageItems"> … </div>
 *   </app-paged-list>
 *
 * The page is CLAMPED to the valid range, so shrinking the list (a filter, a delete) never strands
 * the user on an empty page.
 */
@Component({
  selector: 'app-paged-list',
  template: `
    <ng-content></ng-content>
    <app-pagination *ngIf="totalPages > 1" class="block mt-4"
                    [currentPage]="effectivePage" [totalPages]="totalPages"
                    (pageChange)="page = $event"></app-pagination>
  `,
})
export class PagedListComponent {
  @Input() items: any[] | null = [];
  @Input() pageSize = LIST_PAGE_SIZE;
  page = 1;

  get totalPages(): number { return Math.max(1, Math.ceil((this.items?.length || 0) / this.pageSize)); }
  /** Clamped page — display + slicing use this so an out-of-range page self-corrects. */
  get effectivePage(): number { return Math.min(Math.max(1, this.page), this.totalPages); }
  get pageItems(): any[] {
    const start = (this.effectivePage - 1) * this.pageSize;
    return (this.items || []).slice(start, start + this.pageSize);
  }
}
