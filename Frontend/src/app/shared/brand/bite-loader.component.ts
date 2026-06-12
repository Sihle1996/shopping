import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Loading glyph: the bitten-V is repeatedly *chomped*. A surface-coloured bite carves a chunk out of the
 * V's upper-left edge — it sits ON the silhouette edge so it actually removes part of the shape (reads as a
 * real bite, not a dot inside the V) — an orange ring flashes outward at the moment of the bite, then the V
 * heals and it repeats. Pure CSS, no JS/GSAP. Respects prefers-reduced-motion (shows the bitten state still).
 */
@Component({
  selector: 'app-bite-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bl" [style.--bg]="bg">
      <div class="bl-stage">
        <img class="bl-v" src="assets/craveit-v-complete.png" [style.height.px]="size" alt="" aria-hidden="true" />
        <span class="bl-ring"></span>
        <span class="bl-bite"></span>
      </div>
    </div>
  `,
  styleUrls: ['./bite-loader.component.scss'],
})
export class BiteLoaderComponent {
  @Input() size = 96;
  @Input() bg = '#ffffff';   // surface colour the bite is painted in (matches the card behind the V)
}
