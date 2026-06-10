import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { AdminService } from './admin.service';
import { ConfirmService } from '../shared/services/confirm.service';

/** The minimal order shape the action engine needs — works for any surface (live feed, table, drawer). */
export interface OrderLike {
  id: string;
  status: string;
  paid?: boolean;
  driverName?: string | null;
}

export type OrderActionKind = 'primary' | 'danger' | 'confirm' | 'link';

export interface OrderAction {
  key: 'prepare' | 'deliver' | 'cancel' | 'assign';
  label: string;
  /** primary/danger/confirm render as buttons; `link` is the HARD CTA that opens the driver picker. */
  kind: OrderActionKind;
  /** Status to move to. Absent for `assign` (handled by the host, which opens the drawer). */
  targetStatus?: string;
}

/**
 * One-click order actions — ORCHESTRATION ONLY (the state→buttons mapping, the confirm dialogs, and the
 * call to the backend). It deliberately does NOT own enforcement: the backend (OrderService +
 * OrderStatus.nextStatuses()) is the source of truth, and {@link AdminService.updateOrderStatus}'s
 * optimistic-then-revert catches any drift (a button the backend rejects → revert + error toast). The
 * FLOW map below mirrors the backend purely to RENDER the right buttons, nothing more.
 *
 * Single source of truth so every surface (Dashboard live feed, Orders table) behaves identically — no
 * divergence. This is a parallel primitive: it must not depend on TabbedList/AIAction or shared state.
 */
@Injectable({ providedIn: 'root' })
export class OrderActionsService {
  /** Mirrors backend OrderStatus.nextStatuses() — for RENDERING which buttons to show, not enforcement. */
  private readonly FLOW: Record<string, string[]> = {
    'Pending':          ['Preparing', 'Cancelled'],
    'Scheduled':        ['Preparing', 'Cancelled'],
    'Confirmed':        ['Preparing', 'Cancelled'],
    'Preparing':        ['Out for Delivery', 'Cancelled'],
    'Out for Delivery': ['Delivered', 'Cancelled'],
  };

  constructor(
    private admin: AdminService,
    private confirm: ConfirmService,
    private toastr: ToastrService,
  ) {}

  isTerminal(status?: string | null): boolean {
    return status === 'Delivered' || status === 'Cancelled' || status === 'Rejected';
  }

  /** An unpaid reserved order can't advance into fulfilment (mirrors the backend gate) — only Cancel. */
  isUnpaid(order: OrderLike): boolean {
    return !!order && order.paid === false && (order.status === 'Pending' || order.status === 'Scheduled');
  }

  /**
   * The valid one-click actions for an order's current state. SOFT actions are buttons; the HARD
   * "Assign driver" is a link CTA — Preparing→OFD is coupled to driver assignment (which needs the
   * picker), so it can't be pure one-click.
   */
  actionsFor(order: OrderLike): OrderAction[] {
    const s = order?.status;
    if (!s || this.isTerminal(s) || !this.FLOW[s]) return [];
    const out: OrderAction[] = [];
    if (s === 'Pending' || s === 'Scheduled' || s === 'Confirmed') {
      if (!this.isUnpaid(order)) out.push({ key: 'prepare', label: 'Start preparing', kind: 'primary', targetStatus: 'Preparing' });
    } else if (s === 'Preparing') {
      out.push({ key: 'assign', label: 'Assign driver', kind: 'link' });
    }
    // Out for Delivery has NO quick forward action: the DRIVER confirms delivery (OTP). The admin
    // "Mark delivered" is an override and lives in the drawer, not here.
    out.push({ key: 'cancel', label: 'Cancel', kind: 'danger', targetStatus: 'Cancelled' });
    return out;
  }

  /**
   * Run a non-link action: confirm if needed, then fire the optimistic status update. Emits the new
   * status when committed, or null if cancelled / blocked / no-op. `assign` is handled by the host
   * (it opens the drawer picker), not here.
   */
  run(order: OrderLike, action: OrderAction): Observable<string | null> {
    if (action.kind === 'link' || !action.targetStatus) return of(null);
    const target = action.targetStatus;
    const apply = (reason?: string): string => {
      this.admin.updateOrderStatus(order.id, target, reason);
      return target;
    };
    if (target === 'Delivered') {
      if (!order.driverName) { this.toastr.warning('Assign a driver before marking this order delivered.'); return of(null); }
      return this.confirm.ask({
        title: 'Mark as delivered?',
        message: "This emails the customer that their order was delivered and finalises the sale. It can't be undone.",
        confirmLabel: 'Mark delivered', variant: 'warning',
      }).pipe(map(ok => (ok ? apply() : null)));
    }
    if (target === 'Cancelled') {
      return this.confirm.ask({
        title: 'Cancel this order?',
        message: "This notifies the customer, releases the reserved stock, and can't be undone.",
        confirmLabel: 'Cancel order', variant: 'danger',
        input: { placeholder: 'Reason (saved on the order) — e.g. out of stock, customer request' },
      }).pipe(map(ok => (ok ? apply(this.confirm.lastValue) : null)));
    }
    return of(apply()); // Start preparing — no confirm
  }
}
