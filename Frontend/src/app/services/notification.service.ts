// src/app/services/notification.service.ts
import { Injectable } from '@angular/core';
import { CompatClient, IMessage, Stomp } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private stompClient: CompatClient | null = null;
  private notificationSubject = new Subject<string>();

  constructor() {
    this.client = new Client({
      // Use SockJS
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      // Optional: automatic reconnect
      reconnectDelay: 5000,
      // Silence logs
      debug: () => {}
    });

    // Called after the connection is established
    this.client.onConnect = () => {
      this.client.subscribe('/topic/orders', (message: IMessage) => {
        if (message.body) this.notificationSubject.next(message.body);
      });
    };

    // Optional: error hooks
    this.client.onStompError = frame => {
      console.error('Broker reported error:', frame.headers['message'], frame.body);
    };
    this.client.onWebSocketClose = evt => {
      console.warn('WebSocket closed', evt);
    };

    // Open the connection
    this.client.activate();
  }

  get notifications(): Observable<string> {
    return this.notificationSubject.asObservable();
  }

  ngOnDestroy(): void {
    this.client.deactivate(); // graceful shutdown
  }
}
