import { Component } from '@angular/core';
import { AdminNotification, NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-admin-notifications',
  templateUrl: './admin-notifications.component.html',
  styleUrls: ['./admin-notifications.component.scss']
})
export class AdminNotificationsComponent {
  constructor(public notificationService: NotificationService) {}

  get notifications(): AdminNotification[] {
    return this.notificationService.history;
  }

  get unreadCount(): number {
    return this.notificationService.unreadCount;
  }

  markAllRead(): void {
    this.notificationService.markAllRead();
  }

  markRead(n: AdminNotification): void {
    this.notificationService.markRead(n);
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
}
