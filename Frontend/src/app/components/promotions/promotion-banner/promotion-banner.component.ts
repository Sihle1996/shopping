import { Component, Input } from '@angular/core';
import { Promotion } from 'src/app/services/promotion.service';

@Component({
  selector: 'app-promotion-banner',
  templateUrl: './promotion-banner.component.html',
  styleUrls: ['./promotion-banner.component.scss']
})
export class PromotionBannerComponent {
  @Input() promotion: Promotion | null = null;
}
