import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { IntentChip } from 'src/app/services/intelligence.service';

@Component({
  selector: 'app-intent-chips',
  template: `
    <div *ngIf="chips.length" class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
      <button
        *ngFor="let chip of chips; trackBy: trackByKey"
        (click)="onSelect(chip.key)"
        [ngClass]="getChipClasses(chip.key)">
        <span class="text-base leading-none">{{ chip.emoji }}</span>
        <span>{{ chip.label }}</span>
        <span *ngIf="selected === chip.key"
              (click)="$event.stopPropagation(); onClear()"
              class="ml-1 w-4 h-4 flex items-center justify-center rounded-full bg-white/30 hover:bg-white/50 transition-colors">
          <i class="bi bi-x text-[10px]"></i>
        </span>
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IntentChipsComponent {
  @Input() chips: IntentChip[] = [];
  @Input() selected: string | null = null;
  @Output() intentSelected = new EventEmitter<string>();
  @Output() intentCleared = new EventEmitter<void>();

  trackByKey(_: number, chip: IntentChip): string {
    return chip.key;
  }

  onSelect(key: string): void {
    if (this.selected === key) {
      this.onClear();
    } else {
      this.intentSelected.emit(key);
    }
  }

  onClear(): void {
    this.intentCleared.emit();
  }

  getChipClasses(key: string): string {
    const base = 'flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap active:scale-95 cursor-pointer';
    const active = 'bg-primary text-white shadow-sm';
    const inactive = 'bg-white text-textDark hover:bg-primary-50 brand-trim shadow-card';
    return `${base} ${this.selected === key ? active : inactive}`;
  }
}
