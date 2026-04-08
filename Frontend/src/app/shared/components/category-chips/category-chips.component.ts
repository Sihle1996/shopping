import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

export interface CategoryItem {
  name: string;
  icon?: string;
}

@Component({
  selector: 'app-category-chips',
  template: `
    <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
      <button
        *ngFor="let cat of categories; trackBy: trackByName"
        (click)="select(cat.name)"
        [class]="getChipClasses(cat.name)">
        <img *ngIf="cat.icon" [src]="cat.icon" [alt]="cat.name" class="w-6 h-6 rounded-full object-cover" />
        <span>{{ cat.name }}</span>
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryChipsComponent {
  @Input() categories: CategoryItem[] = [];
  @Input() selected = 'All';
  @Output() selectedChange = new EventEmitter<string>();

  select(name: string): void {
    this.selected = name;
    this.selectedChange.emit(name);
  }

  trackByName(_: number, cat: CategoryItem): string {
    return cat.name;
  }

  getChipClasses(name: string): string {
    const base = 'flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap active:scale-95 cursor-pointer';
    const active = 'bg-primary text-white shadow-sm';
    const inactive = 'bg-white text-textDark hover:bg-primary-50 shadow-card';
    return `${base} ${this.selected === name ? active : inactive}`;
  }
}
