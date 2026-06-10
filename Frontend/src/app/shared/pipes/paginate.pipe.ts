import { Pipe, PipeTransform } from '@angular/core';

/** One shared page size for every paginated admin list — keeps the visible list short enough to fit
 *  the screen without scrolling. Change it here and every list updates. */
export const LIST_PAGE_SIZE = 6;

/**
 * Client-side pagination: returns just the slice for the current page. Pair with <app-pagination>
 * for the controls and `Math.ceil(list.length / size)` for the page count. Keeps long in-tab lists
 * from becoming endless scrolls.
 *
 *   *ngFor="let x of (items | paginate:page:size)"
 */
@Pipe({ name: 'paginate' })
export class PaginatePipe implements PipeTransform {
  transform<T>(items: T[] | null | undefined, page: number, size: number): T[] {
    if (!items?.length || size <= 0) return items ?? [];
    const start = (Math.max(1, page) - 1) * size;
    return items.slice(start, start + size);
  }
}
