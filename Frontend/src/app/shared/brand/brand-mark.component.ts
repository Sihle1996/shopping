import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * The CraveIt "bitten V" — the REAL glyph (extracted from the production logo, craveit-v.png) as a reusable
 * symbol. The bite-fill sits behind the v so orange shows through the real notch; `mode` drives it.
 * `face` optionally turns the V's arms into "horns" with eyes in the negative space:
 *   - hidden : small eyes tucked in the inner space (subtle, premium — a living symbol, still serious)
 *   - beast  : bolder eyes + a brow ridge (charging-animal energy)
 */
@Component({
  selector: 'app-brand-mark',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="bm" [ngClass]="['bm-' + mode, 'bm-face-' + face]" [class.bm-on-dark]="!dark">
      <span class="bm-eye bm-eye-l"></span>
      <span class="bm-eye bm-eye-r"></span>
      <span class="bm-brow"></span>
      <span class="bm-bite"></span>
      <img class="bm-v" src="assets/craveit-v.png" [style.height.px]="size" alt="" aria-hidden="true" />
    </span>
  `,
  styleUrls: ['./brand-mark.component.scss'],
})
export class BrandMarkComponent {
  /** idle = empty bite (matches the logo); the others fill/animate the bite. */
  @Input() mode: 'idle' | 'loading' | 'thinking' | 'success' | 'error' = 'idle';
  /** none = plain mark; hidden/beast/scary turn it into a creature with eyes. */
  @Input() face: 'none' | 'hidden' | 'beast' | 'scary' = 'none';
  @Input() size = 48;
  @Input() dark = true;   // dark glyph on light surfaces; white glyph on dark
}
