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
  product: MenuItem | null = null; // ✅ Ensure product is nullable
  quantity: number = 1; // ✅ Fix: Initialize default quantity

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
      this.router.navigate(['/']); // Redirect if ID is invalid
      return;
    }

    // ✅ Fetch product details
    this.menuService.getProductById(Number(productId)).subscribe({
      next: (product) => {
        console.log("✅ Fetched product:", product);
        this.product = product;
      },
      error: (err) => {
        console.error("❌ Error fetching product:", err);
        this.router.navigate(['/']); // Redirect if product not found
      }
    });
  }

  // ✅ Handle "Add to Cart"
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

    // ✅ Fix: Ensure `quantity` is always passed
    this.cartService.addToCart(this.product.id, this.quantity).subscribe({
      next: () => {
        console.log('✅ Added to cart:', this.product!.id, 'Quantity:', this.quantity);
      },
      error: (err) => {
        console.error("❌ Error adding to cart:", err);
      }
    });
  }

  // ✅ Go Back to Home
  goBack(): void {
    this.router.navigate(['/']);
  }

  // ✅ Increase Quantity
  increaseQuantity(): void {
    this.quantity++;
  }

  // ✅ Decrease Quantity (Ensure it doesn’t go below 1)
  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }
}
