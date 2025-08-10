// src/app/services/notification.service.ts
import { Injectable } from '@angular/core';
import { CompatClient, IMessage, Stomp } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private stompClient: CompatClient | null = null;
  private notificationSubject = new Subject<string>();

  constructor(private authService: AuthService) {
    this.connect();
  }

  private connect(): void {
    const socket = new SockJS('http://localhost:8080/ws');
    this.stompClient = Stomp.over(socket);
    (this.stompClient as any).debug = () => {};

    const headers: { [key: string]: string } = {};
    const token = this.authService.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.stompClient.connect(headers, () => {
      this.stompClient?.subscribe('/user/queue/orders', (message: IMessage) => {
        if (message.body) {
          this.notificationSubject.next(message.body);
        }
      });
    });
  }

  get notifications(): Observable<string> {
    return this.notificationSubject.asObservable();
  }
}
