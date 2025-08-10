// src/app/services/notification.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage, StompHeaders } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ToastrService } from 'ngx-toastr';

export interface OrderEvent {
  type?: string;
  orderId?: string;
  userEmail?: string;
  customer?: { email?: string; name?: string };
  totalAmount?: number;
  total?: number;
  currency?: string;
  driver?: { name?: string } | null;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private client!: Client; // definite assignment
  private notificationSubject = new Subject<string>();

  constructor(private auth: AuthService, private toastr: ToastrService) {
    this.connect();
  }

  get notifications(): Observable<string> {
    return this.notificationSubject.asObservable().pipe(throttleTime(1000));
  }

  private connect(): void {
    const token = this.auth.getToken();
    const connectHeaders: StompHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    this.client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
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

      this.notificationSubject.next(text);
      this.toastr.success(text, 'Order update', { timeOut: 6000 });
    } catch (e) {
      console.error('Failed to parse notification', e, message.body);
      this.notificationSubject.next(message.body);
      this.toastr.info(message.body, 'Notification');
    }
  };

  ngOnDestroy(): void {
    if (this.client?.active) this.client.deactivate();
  }
}
