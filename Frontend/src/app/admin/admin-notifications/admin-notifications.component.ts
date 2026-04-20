import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../services/notification.service';

export interface AdminNotification {
  id: number;
  text: string;
  time: Date;
  read: boolean;
}

@Component({
  selector: 'app-admin-notifications',
  templateUrl: './admin-notifications.component.html',
  styleUrls: ['./admin-notifications.component.scss']
})
export class AdminNotificationsComponent implements OnInit, OnDestroy {
  notifications: AdminNotification[] = [];
  private nextId = 1;
  private sub!: Subscription;

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.sub = this.notificationService.notifications.subscribe(message => {
      this.notifications.unshift({
        id: this.nextId++,
        text: message,
        time: new Date(),
        read: false
      });
      // Keep last 50
      if (this.notifications.length > 50) {
        this.notifications = this.notifications.slice(0, 50);
      }
    });
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  markAllRead(): void {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
  }

  markRead(notification: AdminNotification): void {
    notification.read = true;
  }

  relativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    return `${Math.floor(diffHr / 24)} days ago`;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
