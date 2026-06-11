import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * The CraveIt "bitten V" — the REAL glyph (extracted from the production logo, craveit-v.png) as a reusable
 * symbol. The bite-fill sits *behind* the v, so the black mark masks it and orange shows only through the
 * real notch. mode drives the bite (idle = empty, matching the logo; the rest animate it). One mark powers
 * the loader, AI "thinking" state, badges, the assistant button, empty states, etc.
 */
@Component({
  selector: 'app-brand-mark',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="bm" [ngClass]="'bm-' + mode" [class.bm-on-dark]="!dark">
      <span class="bm-bite"></span>
      <img class="bm-v" src="assets/craveit-v.png" [style.height.px]="size" alt="" aria-hidden="true" />
    </span>
  `,
  styleUrls: ['./brand-mark.component.scss'],
})
export class BrandMarkComponent {
  /** idle = empty bite (matches the logo); the others fill/animate the bite. */
  @Input() mode: 'idle' | 'loading' | 'thinking' | 'success' | 'error' = 'idle';
  @Input() size = 48;
  @Input() dark = true;   // dark glyph on light surfaces; white glyph on dark
}
