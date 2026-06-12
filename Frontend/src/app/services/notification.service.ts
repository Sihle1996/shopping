// src/app/services/notification.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage, StompHeaders } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';
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

  // --- New-order sound alert (per-device; localStorage 'newOrderSound', default on) ---
  private audioCtx?: AudioContext;
  private pendingOrders = 0;
  private repeatTimer: any = null;
  private readonly REPEAT_MS = 8000;   // re-chime cadence (was 15s — felt too slow)

  readonly soundOptions = ['chime', 'bell', 'beep', 'alarm', 'ping'];

  get soundEnabled(): boolean { return localStorage.getItem('newOrderSound') !== 'off'; }
  set soundEnabled(on: boolean) {
    localStorage.setItem('newOrderSound', on ? 'on' : 'off');
    if (!on) this.acknowledgeOrders();
  }

  get soundType(): string { return localStorage.getItem('orderSoundType') || 'chime'; }
  set soundType(t: string) { localStorage.setItem('orderSoundType', t); }

  /** Persistent history — survives component navigation */
  readonly history: AdminNotification[] = [];

  get unreadCount(): number {
    return this.history.filter(n => !n.read).length;
  }

  markAllRead(): void {
    this.history.forEach(n => n.read = true);
    this.acknowledgeOrders();   // seeing the notifications stops the repeating chime
  }

  markRead(n: AdminNotification): void {
    n.read = true;
  }

  /** A new order arrived — chime now and keep chiming until acknowledged (best practice). */
  private onNewOrder(): void {
    if (!this.soundEnabled) return;
    this.pendingOrders++;
    this.playSound();
    this.ensureRepeatLoop();
  }

  private ensureRepeatLoop(): void {
    if (this.repeatTimer) return;
    this.repeatTimer = setInterval(() => {
      if (this.pendingOrders > 0 && this.soundEnabled) this.playSound();
      else this.acknowledgeOrders();
    }, this.REPEAT_MS);
  }

  /** After a page refresh the chime state is lost — re-check the server for unaccepted orders and resume
   *  ringing so the admin doesn't silently miss pending orders. Admin-only. */
  private resumePendingChime(): void {
    if (this.auth.getUserRole() !== 'ROLE_ADMIN' || !this.soundEnabled) return;
    const headers: any = { Authorization: `Bearer ${this.auth.getToken()}` };
    const tid = localStorage.getItem('tenantId');
    if (tid) headers['X-Tenant-Id'] = tid;
    this.http.get<{ count: number }>(`${environment.apiUrl}/api/admin/orders/pending-count`, { headers }).subscribe({
      next: res => {
        if (res?.count > 0) { this.pendingOrders = res.count; this.playSound(); this.ensureRepeatLoop(); }
      },
      error: () => {}
    });
  }

  /** Admin has seen the new orders — stop the repeating chime. */
  acknowledgeOrders(): void {
    this.pendingOrders = 0;
    if (this.repeatTimer) { clearInterval(this.repeatTimer); this.repeatTimer = null; }
  }

  /** Play the selected new-order sound via Web Audio (no asset). Public so the settings screen can preview.
   *  Silently no-ops if audio is blocked (needs a prior user gesture). */
  playSound(type?: string): void {
    const t = type || this.soundType;
    try {
      this.audioCtx = this.audioCtx || new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      const ctx = this.audioCtx!;
      if (ctx.state === 'suspended') ctx.resume();
      switch (t) {
        case 'bell':  this.tones(ctx, [1318, 1760], 'sine', 0.45, 0.13); break;
        case 'beep':  this.tones(ctx, [1000, 1000, 1000], 'square', 0.10, 0.13); break;
        case 'alarm': this.tones(ctx, [988, 740, 988, 740], 'sawtooth', 0.16, 0.16); break;
        case 'ping':  this.tones(ctx, [1568], 'sine', 0.5, 0); break;
        default:      this.tones(ctx, [880, 1175], 'sine', 0.32, 0.16); break;  // chime
      }
    } catch { /* audio blocked until user interaction; ignore */ }
  }

  private tones(ctx: AudioContext, freqs: number[], type: OscillatorType, dur: number, gap: number): void {
    const now = ctx.currentTime;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const start = now + i * (gap || dur * 0.5);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  }

  constructor(private auth: AuthService, private toastr: ToastrService, private http: HttpClient) {
    this.connect();
    this.resumePendingChime();
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
      if (data.type === 'ORDER_CREATED') this.onNewOrder();
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
  /** Live admin alert nudges (background scan pushes here when a new alert is raised). */
  subscribeToAdminAlerts(tenantId: string): Observable<any> {
    const subject = new Subject<any>();
    const topic = `/topic/admin/${tenantId}/alerts`;

    const doSubscribe = () => {
      this.client.subscribe(topic, (msg: IMessage) => {
        try { subject.next(JSON.parse(msg.body)); } catch { /* ignore */ }
      });
    };

    if (this.client?.connected) {
      doSubscribe();
    } else {
      const orig = this.client.onConnect;
      this.client.onConnect = (frame) => { orig?.(frame); doSubscribe(); };
    }
    return subject.asObservable();
  }

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
