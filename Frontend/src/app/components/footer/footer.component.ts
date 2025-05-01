import { Component, OnInit } from '@angular/core';
import { CartService } from 'src/app/services/cart.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
  cartItemCount = 0;

  constructor(private cartService: CartService) {}

  ngOnInit(): void {
    // ✅ Subscribe to cartItemCount so it updates instantly
    this.cartService.getCartItemCount().subscribe(count => {
      this.cartItemCount = count;
    });
  }
}
