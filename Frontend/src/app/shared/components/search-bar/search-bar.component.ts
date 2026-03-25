import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-search-bar',
  template: `
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <i class="bi bi-search text-textMuted"></i>
      </div>
      <input
        type="text"
        [placeholder]="placeholder"
        [value]="value"
        (input)="onInput($event)"
        class="w-full pl-11 pr-10 py-3 bg-white rounded-full border border-borderColor
               text-textDark placeholder-textMuted text-sm
               focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
               transition-shadow shadow-card hover:shadow-card-hover" />
      <button
        *ngIf="value"
        (click)="clear()"
        class="absolute inset-y-0 right-0 pr-4 flex items-center text-textMuted hover:text-textDark transition-colors">
        <i class="bi bi-x-lg text-sm"></i>
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchBarComponent implements OnInit, OnDestroy {
  @Input() placeholder = 'Search dishes...';
  @Input() value = '';
  @Input() debounce = 300;
  @Output() search = new EventEmitter<string>();

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(this.debounce),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => this.search.emit(query));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
    this.searchSubject.next(this.value);
  }

  clear(): void {
    this.value = '';
    this.search.emit('');
  }
}
