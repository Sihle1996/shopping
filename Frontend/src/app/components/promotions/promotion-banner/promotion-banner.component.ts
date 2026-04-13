import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Promotion } from 'src/app/services/promotion.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-promotion-banner',
  templateUrl: './promotion-banner.component.html',
  styleUrls: ['./promotion-banner.component.scss']
})
export class PromotionBannerComponent implements OnInit, OnDestroy {
  @Input() promotion: Promotion | null = null;

  countdown = '';
  private timer: any;

  ngOnInit(): void {
    this.updateCountdown();
    this.timer = setInterval(() => this.updateCountdown(), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  get showCountdown(): boolean {
    if (!this.promotion?.endAt) return false;
    const msLeft = new Date(this.promotion.endAt).getTime() - Date.now();
    return msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000; // within 24h
  }

  private updateCountdown(): void {
    if (!this.promotion?.endAt) return;
    const msLeft = new Date(this.promotion.endAt).getTime() - Date.now();
    if (msLeft <= 0) { this.countdown = 'Expired'; return; }
    const h = Math.floor(msLeft / 3600000);
    const m = Math.floor((msLeft % 3600000) / 60000);
    const s = Math.floor((msLeft % 60000) / 1000);
    this.countdown = h > 0
      ? `${h}h ${String(m).padStart(2,'0')}m`
      : `${m}m ${String(s).padStart(2,'0')}s`;
  }

  resolveImageUrl(url: string | undefined): string {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${environment.apiUrl}${url}`;
  }
}
