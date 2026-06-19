import { Injectable } from '@angular/core';

/**
 * Admin-only dark mode. `isDark` is bound to `.admin-dark` on the admin-layout root (drives the
 * dark surfaces + canvas). It is ALSO flagged on <body> so the shared top navbar — which renders
 * outside the admin shell — darkens too. The body flag is removed when the admin shell unmounts
 * (teardown) so it can never leak into the customer storefront, which is the same Angular app.
 */
@Injectable({ providedIn: 'root' })
export class AdminThemeService {
  private readonly KEY = 'adminDark';
  isDark = false;

  init(): void {
    this.isDark = localStorage.getItem(this.KEY) === 'on';
    this.applyBody();
  }

  toggle(): void {
    this.isDark = !this.isDark;
    localStorage.setItem(this.KEY, this.isDark ? 'on' : 'off');
    this.applyBody();
  }

  /** Drop the body flag when leaving the admin shell so customer pages stay light. */
  teardown(): void {
    document.body.classList.remove('admin-dark');
  }

  private applyBody(): void {
    document.body.classList.toggle('admin-dark', this.isDark);
  }
}
