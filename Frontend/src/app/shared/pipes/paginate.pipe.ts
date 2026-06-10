import { Pipe, PipeTransform } from '@angular/core';

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
