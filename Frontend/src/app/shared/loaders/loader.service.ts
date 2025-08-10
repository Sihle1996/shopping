import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private requests = 0;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  show(): void {
    this.requests++;
    if (this.requests === 1) {
      this.loadingSubject.next(true);
    }
  }

  hide(): void {
    if (this.requests > 0) {
      this.requests--;
      if (this.requests === 0) {
        this.loadingSubject.next(false);
      }
    }
  }
}
