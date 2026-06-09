import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  /** When set, the dialog shows a text box; read the entered text from `lastValue` after confirm. */
  input?: { placeholder?: string };
}

/**
 * App-wide confirmation prompt. Call `ask(...)` and act on the boolean:
 *
 *   this.confirm.ask({ message: 'Remove this driver?' })
 *     .subscribe(ok => { if (ok) this.doDelete(); });
 *
 * A single <app-confirm-host> (in AppComponent) renders the styled dialog,
 * so destructive actions get a consistent "are you sure?" without each page
 * wiring its own modal.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current$ = new BehaviorSubject<ConfirmOptions | null>(null);
  private result$?: Subject<boolean>;
  /** Text the user typed into the optional input, available after the confirm resolves. */
  lastValue = '';

  ask(opts: ConfirmOptions): Observable<boolean> {
    this.lastValue = '';
    this.result$?.complete();
    this.result$ = new Subject<boolean>();
    this.current$.next({
      title: 'Are you sure?',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      variant: 'danger',
      ...opts,
    });
    return this.result$.asObservable();
  }

  respond(ok: boolean, value = ''): void {
    this.lastValue = value;
    this.current$.next(null);
    this.result$?.next(ok);
    this.result$?.complete();
    this.result$ = undefined;
  }
}
