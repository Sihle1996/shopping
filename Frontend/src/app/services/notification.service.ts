// src/app/services/notification.service.ts
import { Injectable } from '@angular/core';
import { CompatClient, IMessage, Stomp } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ToastrService } from 'ngx-toastr';


@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private stompClient: CompatClient | null = null;
  private notificationSubject = new Subject<string>();


  constructor(private authService: AuthService, private toastr: ToastrService) {

    this.connect();
  }

  private connect(): void {
    const socketFactory = () => new SockJS('http://localhost:8080/ws');
    this.stompClient = Stomp.over(socketFactory);
    (this.stompClient as any).debug = () => {};

    const headers: { [key: string]: string } = {};
    const token = this.authService.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.stompClient.connect(headers, () => {
      this.stompClient?.subscribe('/user/queue/orders', (message: IMessage) => {
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
    return this.notificationSubject.asObservable().pipe(throttleTime(1000));
  }
}
