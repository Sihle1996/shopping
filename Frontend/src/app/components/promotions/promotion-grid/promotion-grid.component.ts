import { Component, Input } from '@angular/core';
import { Promotion } from 'src/app/services/promotion.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-promotion-grid',
  templateUrl: './promotion-grid.component.html',
  styleUrls: ['./promotion-grid.component.scss']
})
export class PromotionGridComponent {
  @Input() promotions: Promotion[] = [];

  resolveImageUrl(url: string | undefined): string {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${environment.apiUrl}${url}`;
  }
}
