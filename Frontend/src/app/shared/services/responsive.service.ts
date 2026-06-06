import { Injectable } from '@angular/core';
import { Observable, fromEvent } from 'rxjs';
import { distinctUntilChanged, map, shareReplay, startWith } from 'rxjs/operators';

/**
 * Central place to react to screen size instead of fixing each layout by hand.
 *
 * For pure layout (show/hide/resize), prefer Tailwind responsive prefixes in the
 * template — e.g. `grid-cols-1 md:grid-cols-3`, `hidden lg:flex`. They need no JS
 * and don't flicker. Use this service when the breakpoint must drive TypeScript
 * logic or which component renders (e.g. a map only on desktop, a bottom sheet on
 * mobile).
 *
 * Breakpoints match Tailwind's defaults: mobile < 768, tablet 768–1023, desktop ≥ 1024.
 *
 * Template:   *ngIf="responsive.isMobile$ | async"
 * Component:  if (this.responsive.isMobile) { ... }
 */
@Injectable({ providedIn: 'root' })
export class ResponsiveService {
  private readonly mobileQuery = '(max-width: 767px)';
  private readonly tabletQuery = '(min-width: 768px) and (max-width: 1023px)';
  private readonly desktopQuery = '(min-width: 1024px)';

  /** < 768px */
  readonly isMobile$ = this.observe(this.mobileQuery);
  /** 768px – 1023px */
  readonly isTablet$ = this.observe(this.tabletQuery);
  /** ≥ 1024px */
  readonly isDesktop$ = this.observe(this.desktopQuery);

  get isMobile(): boolean {
    return window.matchMedia(this.mobileQuery).matches;
  }
  get isTablet(): boolean {
    return window.matchMedia(this.tabletQuery).matches;
  }
  get isDesktop(): boolean {
    return window.matchMedia(this.desktopQuery).matches;
  }

  /** Observe any media query, e.g. observe('(min-width: 1280px)'). */
  observe(query: string): Observable<boolean> {
    const mql = window.matchMedia(query);
    return fromEvent<MediaQueryListEvent>(mql, 'change').pipe(
      map(e => e.matches),
      startWith(mql.matches),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}
