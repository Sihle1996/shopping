import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * A 4-step segmented "maturity" meter for an experiment's read.
 * `signal` drives how many steps light up (PENDING → MEASURED); `dataQuality` (PRODUCT scope) tints the
 * final colour; `windowDays` adds a "~N days to a reliable read" caption while still maturing.
 * Point-in-time data has no time series — this communicates *confidence*, not a trend.
 */
@Component({
  selector: 'app-confidence-meter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full">
      <div class="flex items-center gap-1.5">
        <span class="flex-1 flex gap-1" role="img" [attr.aria-label]="label + ' — step ' + level + ' of 4'">
          <span *ngFor="let s of [1,2,3,4]"
                class="h-1.5 flex-1 rounded-full transition-colors"
                [ngClass]="s <= level ? fillClass : 'bg-gray-200'"></span>
        </span>
        <span class="text-[11px] font-semibold whitespace-nowrap" [ngClass]="textClass">{{ label }}</span>
      </div>
      <p *ngIf="caption" class="text-[11px] text-textMuted mt-1">{{ caption }}</p>
    </div>
  `,
})
export class ConfidenceMeterComponent {
  @Input() signal: 'PENDING' | 'EARLY' | 'MEASURING' | 'MEASURED' | string = 'PENDING';
  @Input() dataQuality?: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  @Input() windowDays?: number | null;
  /** Override the auto caption (e.g. for the store summary). */
  @Input() captionOverride?: string;

  /** 1–4 steps lit, from the signal. */
  get level(): number {
    return ({ PENDING: 1, EARLY: 2, MEASURING: 3, MEASURED: 4 } as any)[this.signal] ?? 1;
  }

  private get matured(): boolean { return this.signal === 'MEASURED'; }

  /** Colour gradient: gray (pending) → amber (in progress) → success (measured, by quality). */
  get fillClass(): string {
    if (this.matured) return this.dataQuality === 'LOW' ? 'bg-amber-400' : 'bg-brand-teal';
    if (this.level >= 2) return 'bg-amber-400';
    return 'bg-gray-300';
  }
  get textClass(): string {
    if (this.matured) return this.dataQuality === 'LOW' ? 'text-amber-700' : 'text-brand-teal';
    if (this.level >= 2) return 'text-amber-700';
    return 'text-textMuted';
  }

  get label(): string {
    if (this.matured) return this.dataQuality ? this.qualityLabel : 'Measured';
    return ({ PENDING: 'Pending', EARLY: 'Early read', MEASURING: 'Measuring…' } as any)[this.signal] ?? 'Pending';
  }
  private get qualityLabel(): string {
    return ({ HIGH: 'High confidence', MEDIUM: 'Good read', LOW: 'Low confidence' } as any)[this.dataQuality || ''] ?? 'Measured';
  }

  get caption(): string {
    if (this.captionOverride) return this.captionOverride;
    if (this.matured) return '';
    if (this.windowDays && this.windowDays > 0) {
      return `~${this.windowDays} day${this.windowDays === 1 ? '' : 's'} of orders for a reliable read`;
    }
    return this.signal === 'PENDING' ? 'Not enough orders yet' : '';
  }
}
