import { Injectable } from '@angular/core';

/**
 * Admin-only dark mode. `isDark` is bound to `.admin-dark` on the admin-layout root, so the dark
 * theme is structurally scoped to the admin shell — it cannot leak into the customer storefront
 * (which never renders inside admin-layout) and is removed automatically when the admin module
 * unmounts. The store's brand colour stays the accent (brand CSS vars are untouched).
 */
@Injectable({ providedIn: 'root' })
export class AdminThemeService {
  private readonly KEY = 'adminDark';
  isDark = false;

  init(): void {
    this.isDark = localStorage.getItem(this.KEY) === 'on';
  }

  toggle(): void {
    this.isDark = !this.isDark;
    localStorage.setItem(this.KEY, this.isDark ? 'on' : 'off');
  }
}
