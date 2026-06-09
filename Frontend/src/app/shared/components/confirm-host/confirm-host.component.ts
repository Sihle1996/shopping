import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ConfirmService } from '../../services/confirm.service';

/**
 * Single global renderer for ConfirmService. Placed once in AppComponent so any
 * component can trigger a styled confirmation dialog via ConfirmService.ask().
 */
@Component({
  selector: 'app-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="confirm.current$ | async as opts">
      <app-confirm-modal
        [isOpen]="true"
        [title]="opts.title || 'Are you sure?'"
        [message]="opts.message || ''"
        [confirmLabel]="opts.confirmLabel || 'Confirm'"
        [cancelLabel]="opts.cancelLabel || 'Cancel'"
        [variant]="opts.variant || 'danger'"
        [input]="opts.input || null"
        (confirmed)="confirm.respond(true, $event)"
        (cancelled)="confirm.respond(false)">
      </app-confirm-modal>
    </ng-container>
  `,
})
export class ConfirmHostComponent {
  constructor(public confirm: ConfirmService) {}
}
