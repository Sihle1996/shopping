import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

let _bmUid = 0;

/**
 * The CraveIt "bitten V" — the brand motif as a reusable vector symbol. The bite can fill / glow / pulse,
 * so one mark powers the loader, the AI "thinking" state, notification badges, the assistant button,
 * empty states, etc. (Approximation of the production glyph until the official vector is available.)
 */
@Component({
  selector: 'app-brand-mark',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg class="bm" [ngClass]="'bm-' + mode" [style.width.px]="size" [style.height.px]="size"
         viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <defs>
        <mask [attr.id]="mid">
          <rect x="0" y="0" width="120" height="120" fill="#fff" />
          <path [attr.d]="bitePath" fill="#000" />
        </mask>
      </defs>
      <!-- the bold "v", with the bite cut out -->
      <path class="bm-v" d="M21 30 L60 99 L99 30"
            [attr.stroke]="dark ? '#1F2937' : '#ffffff'" stroke-width="25"
            stroke-linecap="round" stroke-linejoin="round" [attr.mask]="'url(#' + mid + ')'" />
      <!-- the bite — sharp angular notch; fills with orange when active -->
      <path class="bm-bite" [attr.d]="bitePath" fill="#E76F51" />
    </svg>
  `,
  styleUrls: ['./brand-mark.component.scss'],
})
export class BrandMarkComponent {
  /** idle = empty bite (matches the logo); the others animate the bite. */
  @Input() mode: 'idle' | 'loading' | 'thinking' | 'success' | 'error' = 'idle';
  @Input() size = 48;
  @Input() dark = true;          // dark "v" on light surfaces; white "v" on dark
  /** the angular "bite" notch in the top of the right arm (approx the glyph) */
  bitePath = 'M73 28 L95 30 L88 41 L96 49 L80 45 Z';
  mid = 'bm' + (++_bmUid);
}
