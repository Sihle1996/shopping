import { Component } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { CartService } from 'src/app/services/cart.service';


@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  cartItemCount = 0;
  userId: number | null = null;

  constructor(private cartService: CartService, private authService: AuthService) {}

  ngOnInit(): void {
    this.userId = this.authService.getUserId(); // ✅ Get user ID

    if (this.userId !== null) {
      this.cartService.getCartItems(this.userId).subscribe(cartItems => {
        this.cartItemCount = cartItems.length;
      });
    }
  }
}
