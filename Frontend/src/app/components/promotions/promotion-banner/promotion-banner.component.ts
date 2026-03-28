import { Component, Input } from '@angular/core';
import { Promotion } from 'src/app/services/promotion.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-promotion-banner',
  templateUrl: './promotion-banner.component.html',
  styleUrls: ['./promotion-banner.component.scss']
})
export class PromotionBannerComponent {
  @Input() promotion: Promotion | null = null;

  resolveImageUrl(url: string | undefined): string {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${environment.apiUrl}${url}`;
  }
}
