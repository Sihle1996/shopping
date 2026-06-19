import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Before → During comparison as twin proportional bars + a signed % delta chip.
 * Point-in-time (two snapshots), not a time series — so two bars, not a line. `format` picks the value
 * formatting (rand / units / plain). Colours follow the direction: up = success, down = danger.
 */
@Component({
  selector: 'app-delta-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-textMuted">{{ label }}</span>
        <span class="inline-flex items-center gap-1 text-xs font-bold font-numbers px-1.5 py-0.5 rounded-lg"
              [ngClass]="chipClass">
          <i class="ph text-[10px]" [ngClass]="arrow"></i>{{ deltaText }}
        </span>
      </div>

      <div class="space-y-1.5">
        <!-- Before -->
        <div class="flex items-center gap-2">
          <span class="w-12 text-[10px] text-textMuted flex-shrink-0">{{ beforeLabel }}</span>
          <span class="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <span class="block h-full rounded-full bg-gray-300" [style.width.%]="beforeWidth"></span>
          </span>
          <span class="w-16 text-right text-[11px] font-numbers text-textDark flex-shrink-0">{{ fmt(before) }}</span>
        </div>
        <!-- During -->
        <div class="flex items-center gap-2">
          <span class="w-12 text-[10px] text-textMuted flex-shrink-0">{{ duringLabel }}</span>
          <span class="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <span class="block h-full rounded-full transition-all" [ngClass]="barClass" [style.width.%]="duringWidth"></span>
          </span>
          <span class="w-16 text-right text-[11px] font-numbers font-semibold text-textDark flex-shrink-0">{{ fmt(during) }}</span>
        </div>
      </div>
    </div>
  `,
})
export class DeltaBarComponent {
  @Input() before = 0;
  @Input() during = 0;
  @Input() label = '';
  @Input() format: 'rand' | 'units' | 'plain' = 'plain';
  @Input() beforeLabel = 'Before';
  @Input() duringLabel = 'During';

  private get max(): number { return Math.max(this.before, this.during, 1); }
  get beforeWidth(): number { return Math.round((this.before / this.max) * 100); }
  get duringWidth(): number { return Math.round((this.during / this.max) * 100); }

  /** Signed % change before → during (null when there's no baseline to divide by). */
  get deltaPercent(): number | null {
    if (!this.before) return this.during > 0 ? null : 0;   // no baseline → % is undefined
    return Math.round(((this.during - this.before) / this.before) * 100);
  }
  get deltaText(): string {
    const d = this.deltaPercent;
    if (d == null) return 'new';
    return (d > 0 ? '+' : '') + d + '%';
  }

  private get up(): boolean { return this.during > this.before; }
  private get down(): boolean { return this.during < this.before; }

  get arrow(): string { return this.up ? 'ph-fill ph-caret-up' : this.down ? 'ph-fill ph-caret-down' : 'ph ph-minus'; }
  get chipClass(): string {
    return this.up ? 'bg-emerald-50 text-emerald-700' : this.down ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-textMuted';
  }
  get barClass(): string {
    return this.up ? 'bg-brand-teal' : this.down ? 'bg-danger' : 'bg-gray-300';
  }

  fmt(v: number): string {
    if (v == null) return '—';
    if (this.format === 'rand') return 'R' + Math.round(v).toLocaleString('en-ZA');
    if (this.format === 'units') return Math.round(v).toLocaleString('en-ZA');
    return v.toLocaleString('en-ZA');
  }
}
