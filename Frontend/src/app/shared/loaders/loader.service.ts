import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private requests = 0;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  show(): void {
    this.requests++;
    if (this.requests === 1) {
      this.loadingSubject.next(true);
    }
    // Safety net: never let the blocking overlay linger if a request hangs
    // (e.g. a cold backend that never responds). Re-armed on each request.
    if (this.safetyTimer) { clearTimeout(this.safetyTimer); }
    this.safetyTimer = setTimeout(() => this.forceHide(), 20000);
  }

  hide(): void {
    if (this.requests > 0) {
      this.requests--;
      if (this.requests === 0) {
        this.clearSafety();
        this.loadingSubject.next(false);
      }
    }
  }

  private forceHide(): void {
    this.requests = 0;
    this.clearSafety();
    this.loadingSubject.next(false);
  }

  private clearSafety(): void {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
  }
}
