import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CartService } from 'src/app/services/cart.service';
import { MenuItem, MenuService } from 'src/app/services/menu.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-product',
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss']
})
export class ProductComponent {
  product: MenuItem | null = null;
  quantity: number = 1;
  selectedSize: string = 'M';

  constructor(
    private route: ActivatedRoute,
    private menuService: MenuService,
    private cartService: CartService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log("🚀 ProductComponent initialized!");
    const productId = this.route.snapshot.paramMap.get('id');

    if (!productId) {
      console.error("❌ Invalid product ID");
      this.router.navigate(['/']);
      return;
    }

    this.menuService.getProductById(Number(productId)).subscribe({
      next: (product) => {
        console.log("✅ Fetched product:", product);
        this.product = product;
      },
      error: (err) => {
        console.error("❌ Error fetching product:", err);
        this.router.navigate(['/']);
      }
    });
  }

  addToCart(): void {
    if (!this.product) {
      console.error("❌ Product is null, cannot add to cart.");
      return;
    }

    if (!this.authService.isLoggedIn()) {
      console.error("❌ User not logged in.");
      this.router.navigate(['/login']);
      return;
    }

    if (this.product.id === null) {
      console.error("❌ Product ID is null.");
      return;
    }

    this.cartService.addToCart(this.product.id, this.quantity, this.selectedSize).subscribe({
      next: () => {
        console.log('✅ Added to cart:', this.product!.id, 'Quantity:', this.quantity, 'Size:', this.selectedSize);
      },
      error: (err) => {
        console.error("❌ Error adding to cart:", err);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  increaseQuantity(): void {
    this.quantity++;
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  selectSize(size: string): void {
    this.selectedSize = size;
    console.log("📏 Selected Size:", this.selectedSize);
  }
}
