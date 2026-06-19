import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/services/admin.service';

interface ActivityEvent {
  source: string; action: string; entityType?: string; entityId?: string;
  summary: string; actor?: string; createdAt: string;
}

@Component({
  selector: 'app-admin-activity',
  templateUrl: './admin-activity.component.html'
})
export class AdminActivityComponent implements OnInit {
  events: ActivityEvent[] = [];
  loading = true;
  loadingMore = false;
  page = 0;
  hasMore = false;

  constructor(private admin: AdminService) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    const first = this.page === 0;
    if (first) this.loading = true; else this.loadingMore = true;
    this.admin.getActivity(this.page, 40).subscribe({
      next: (res: any) => {
        const content: ActivityEvent[] = res?.content ?? [];
        this.events = first ? content : [...this.events, ...content];
        this.hasMore = res ? res.last === false : false;
        this.loading = false; this.loadingMore = false;
      },
      error: () => { this.loading = false; this.loadingMore = false; }
    });
  }

  more(): void { this.page++; this.load(); }

  sourceMeta(source: string): { icon: string; cls: string } {
    return ({
      ADMIN:  { icon: 'ph-fill ph-user', cls: 'bg-blue-100 text-blue-600' },
      DRIVER: { icon: 'ph-truck',        cls: 'bg-emerald-100 text-emerald-600' },
      AI:     { icon: 'ph-sparkle',      cls: 'bg-primary-100 text-primary' },
      SYSTEM: { icon: 'ph-fill ph-gear-six', cls: 'bg-gray-100 text-gray-500' }
    } as any)[source] ?? { icon: 'ph-circle', cls: 'bg-gray-100 text-gray-500' };
  }
}
