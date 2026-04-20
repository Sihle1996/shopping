// src/app/services/notification.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage, StompHeaders } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

export interface OrderEvent {
  type?: string;
  orderId?: string;
  status?: string;
  userEmail?: string;
  customer?: { email?: string; name?: string };
  totalAmount?: number;
  total?: number;
  currency?: string;
  driver?: { name?: string } | null;
}

export interface AdminNotification {
  id: number;
  text: string;
  time: Date;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private client!: Client;
  private notificationSubject = new Subject<string>();
  private orderEventSubject = new Subject<OrderEvent>();
  private nextId = 1;

  /** Persistent history — survives component navigation */
  readonly history: AdminNotification[] = [];

  get unreadCount(): number {
    return this.history.filter(n => !n.read).length;
  }

  markAllRead(): void {
    this.history.forEach(n => n.read = true);
  }

  markRead(n: AdminNotification): void {
    n.read = true;
  }

  constructor(private auth: AuthService, private toastr: ToastrService) {
    this.connect();
  }

  /** Throttled text stream — used for toasts and history */
  get notifications(): Observable<string> {
    return this.notificationSubject.asObservable().pipe(throttleTime(200));
  }

  /** Raw typed event stream — no throttle, use for instant UI updates */
  get orderEvents(): Observable<OrderEvent> {
    return this.orderEventSubject.asObservable();
  }

  private connect(): void {
    const token = this.auth.getToken();
    const connectHeaders: StompHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    this.client = new Client({
      webSocketFactory: () => new SockJS(`${environment.apiUrl}/ws`),
      connectHeaders,
      reconnectDelay: 5000,
      debug: () => {}
    });

    this.client.onConnect = () => {
      // Broadcasts to admins
      this.client.subscribe('/topic/orders', this.handleMessage);
      // Per-user queue (requires backend user destinations)
      this.client.subscribe('/user/queue/orders', this.handleMessage);
    };

    this.client.onStompError = frame => {
      console.error('Broker error:', frame.headers['message'], frame.body);
      this.toastr.error('Live updates error. Retrying…', 'WebSocket');
    };
    this.client.onWebSocketError = err => {
      console.error('WS error:', err);
    };
    this.client.onWebSocketClose = evt => {
      console.warn('WS closed', evt);
    };

    this.client.activate();
  }

  private handleMessage = (message: IMessage) => {
    if (!message.body) return;
    try {
      const data: OrderEvent = JSON.parse(message.body);

      const email = data.userEmail ?? data.customer?.email ?? data.customer?.name ?? 'customer';
      const total = (data.totalAmount ?? data.total ?? 0).toFixed(2);
      const currency = data.currency ?? 'ZAR';

      const text =
        data.type === 'ORDER_CREATED'
          ? `New order #${data.orderId} from ${email} — ${currency} ${total}`
          : data.type === 'ORDER_ASSIGNED'
          ? `Order #${data.orderId} assigned to ${data.driver?.name ?? 'driver'}`
          : data.type === 'ORDER_UPDATED'
          ? `Order #${data.orderId} updated`
          : data.type === 'ORDER_CANCELLED'
          ? `Order #${data.orderId} cancelled`
          : typeof message.body === 'string'
          ? message.body
          : 'New notification';

      this.addToHistory(text);
      this.notificationSubject.next(text);
      this.orderEventSubject.next(data);
      this.toastr.success(text, 'Order update', { timeOut: 6000 });
    } catch (e) {
      console.error('Failed to parse notification', e, message.body);
      this.addToHistory(message.body);
      this.notificationSubject.next(message.body);
      this.toastr.info(message.body, 'Notification');
    }
  };

  private addToHistory(text: string): void {
    this.history.unshift({ id: this.nextId++, text, time: new Date(), read: false });
    if (this.history.length > 50) this.history.splice(50);
  }

  /** Subscribe to real-time order updates for a specific customer user ID. */
  subscribeToOrderUpdates(userId: string): Observable<any> {
    const subject = new Subject<any>();
    const topic = `/topic/orders/${userId}`;

    const doSubscribe = () => {
      this.client.subscribe(topic, (msg: IMessage) => {
        try { subject.next(JSON.parse(msg.body)); } catch { /* ignore */ }
      });
    };

    if (this.client?.connected) {
      doSubscribe();
    } else {
      const orig = this.client.onConnect;
      this.client.onConnect = (frame) => {
        orig?.(frame);
        doSubscribe();
      };
    }

    return subject.asObservable();
  }

  ngOnDestroy(): void {
    if (this.client?.active) this.client.deactivate();
  }
}
