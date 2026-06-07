import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Lets any admin page hand a context-specific question to the global Store
 * Copilot widget (which lives in the admin layout). Pages call `ask(...)`;
 * the copilot opens and runs it.
 */
@Injectable({ providedIn: 'root' })
export class CopilotService {
  private askSubject = new Subject<string>();
  /** Emitted when a page wants the copilot to answer something. */
  asks$ = this.askSubject.asObservable();

  ask(question: string): void {
    this.askSubject.next(question);
  }
}
