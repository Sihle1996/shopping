import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OrderAction, OrderActionsService, OrderLike } from '../../../services/order-actions.service';

/**
 * Inline one-click order actions — turns a read-only order row into a control surface. Renders the valid
 * actions for the order's state (via {@link OrderActionsService}): soft actions as buttons, the hard
 * "Assign driver" as a link CTA. Emits {@link changed} after a status change so the host updates its own
 * list, and {@link assignDriver} when the operator wants the driver picker (host opens the drawer).
 *
 * Parallel primitive: actions only — no navigation logic, no tabs, no AI; the host wires those.
 */
@Component({
  selector: 'app-order-actions',
  templateUrl: './order-actions.component.html',
})
export class OrderActionsComponent {
  @Input() order!: OrderLike;
  /** Tighter buttons for dense surfaces (table rows / live feed). */
  @Input() compact = false;
  /** Emitted after a status change is applied — host updates its own list optimistically. */
  @Output() changed = new EventEmitter<{ id: string; status: string }>();
  /** Hard action — host opens the driver picker (the order drawer). */
  @Output() assignDriver = new EventEmitter<OrderLike>();

  constructor(public actions: OrderActionsService) {}

  get items(): OrderAction[] { return this.order ? this.actions.actionsFor(this.order) : []; }
  get unpaid(): boolean { return this.order ? this.actions.isUnpaid(this.order) : false; }

  onClick(action: OrderAction, ev: Event): void {
    ev.stopPropagation(); // never trigger a parent row's routerLink
    if (action.kind === 'link') { this.assignDriver.emit(this.order); return; }
    this.actions.run(this.order, action).subscribe(status => {
      if (status) this.changed.emit({ id: this.order.id, status });
    });
  }
}
