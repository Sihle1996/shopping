import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

interface QueueItem<T> {
  request$: Observable<T>;
}

@Injectable({ providedIn: 'root' })
export class OptimisticService {
  private queue: QueueItem<any>[] = [];

  constructor(private toastr: ToastrService) {}

  /**
   * Apply a local change immediately, enqueue the server request
   * and reconcile when the response arrives.
   */
  enqueue<T>(
    localUpdate: () => void,
    request$: Observable<T>,
    rollback: () => void,
    successMessage: string,
    errorMessage: string
  ): void {
    // Apply local update
    localUpdate();

    // Track request in queue
    this.queue.push({ request$ });

    request$.subscribe({
      next: () => {
        this.queue.shift();
        this.toastr.success(successMessage);
      },
      error: () => {
        this.queue.shift();
        rollback();
        this.toastr.error(errorMessage);
      }
    });
  }
}

