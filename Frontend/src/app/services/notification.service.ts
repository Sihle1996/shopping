// src/app/services/notification.service.ts
import { Injectable } from '@angular/core';
import { CompatClient, IMessage, Stomp } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private stompClient: CompatClient | null = null;
  private notificationSubject = new Subject<string>();

  constructor(private toastr: ToastrService) {
    this.connect();
  }

  private connect(): void {
    const socket = new SockJS('http://localhost:8080/ws');
    this.stompClient = Stomp.over(socket);
    // Disable verbose debug logging
    (this.stompClient as any).debug = () => {};

    this.stompClient.connect(
      {},
      () => {
        this.stompClient?.subscribe('/topic/orders', (message: IMessage) => {
          if (message.body) {
            this.notificationSubject.next(message.body);
          }
        });
      },
      (error: any) => {
        console.error('STOMP connection error', error);
        this.toastr.error('Failed to connect to notifications', 'Connection Error');
      }
    );
  }

  get notifications(): Observable<string> {
    return this.notificationSubject.asObservable();
  }
}
