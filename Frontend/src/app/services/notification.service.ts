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
    this.connect();
  }

  private connect(): void {
    const socket = new SockJS('http://localhost:8080/ws');
    this.stompClient = Stomp.over(socket);
    // Disable verbose debug logging
    (this.stompClient as any).debug = () => {};

    this.stompClient.connect({}, () => {
      this.stompClient?.subscribe('/topic/orders', (message: IMessage) => {
        if (message.body) {
          try {
            const data = JSON.parse(message.body);
            const userEmail = data.userEmail ?? 'Unknown user';
            const totalAmount = Number(data.totalAmount ?? 0).toFixed(2);
            const formatted = `New order from ${userEmail} totaling R${totalAmount}`;
            this.notificationSubject.next(formatted);
          } catch (e) {
            console.error('Failed to parse notification', e);
          }
        }
      });
    });
  }

  get notifications(): Observable<string> {
    return this.notificationSubject.asObservable();
  }
}
