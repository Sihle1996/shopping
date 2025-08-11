import { Component, OnDestroy, OnInit } from '@angular/core';
import { CompatClient, Stomp } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-admin-diagnostics',
  templateUrl: './admin-diagnostics.component.html',
  styleUrls: ['./admin-diagnostics.component.scss']
})
export class AdminDiagnosticsComponent implements OnInit, OnDestroy {
  health: any;
  logs: any[] = [];
  private stompClient: CompatClient | null = null;

  constructor(private adminService: AdminService, private authService: AuthService) {}

  ngOnInit(): void {
    this.fetchHealth();
    this.connect();
  }

  ngOnDestroy(): void {
    this.stompClient?.disconnect(() => {});
  }

  fetchHealth(): void {
    this.adminService.getHealth().subscribe({
      next: (data) => this.health = data,
      error: (err) => console.error('Failed to load health', err)
    });
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
      this.stompClient?.subscribe('/topic/diagnostics', (message) => {
        if (message.body) {
          try {
            const data = JSON.parse(message.body);
            this.logs.push(data);
          } catch (e) {
            console.error('Invalid diagnostics message', e);
          }
        }
      });
    });
  }
}
