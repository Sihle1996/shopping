import { Component, Input } from '@angular/core';
import { Promotion } from 'src/app/services/promotion.service';

@Component({
  selector: 'app-promotion-grid',
  templateUrl: './promotion-grid.component.html',
  styleUrls: ['./promotion-grid.component.scss']
})
export class PromotionGridComponent {
  @Input() promotions: Promotion[] = [];
}
