import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CartService } from 'src/app/services/cart.service';
import { MenuItem, MenuService } from 'src/app/services/menu.service';

@Component({
  selector: 'app-product',
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss']
})
export class ProductComponent {
  product: MenuItem | null = null;
  quantity: number = 1; // Default quantity

  constructor(
    private route: ActivatedRoute,
    private menuService: MenuService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    console.log("🚀 ProductComponent initialized!"); // Debugging line
    const productId = this.route.snapshot.paramMap.get('id');

    console.log("Product ID from route:", productId); // ✅ Debugging line

    if (!productId) {
      console.error("Invalid product ID");
      this.router.navigate(['/']); // Redirect if ID is invalid
      return;
    }

    // ✅ Fetch the product details from API
    this.menuService.getProductById(Number(productId)).subscribe({
      next: (product) => {
        console.log("Fetched product:", product); // ✅ Debugging line
        this.product = product;
      },
      error: (err) => {
        console.error("Error fetching product:", err);
        this.router.navigate(['/']); // Redirect if product not found
      }
    });
  }

  // ✅ Increase quantity
  increaseQuantity(): void {
    this.quantity++;
  }

  // ✅ Decrease quantity (ensure it doesn't go below 1)
  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  // ✅ Add product to cart
  addToCart(): void {
    if (!this.product) {
      console.error("Product is null, cannot add to cart.");
      return;
    }

    const userId = Number(localStorage.getItem('userId')); // Retrieve user ID from localStorage

    if (!userId || isNaN(userId)) {
      console.error("User not logged in.");
      this.router.navigate(['/login']);
      return;
    }

    // ✅ Add product to cart with selected quantity
    this.cartService.addToCart(userId, this.product.id, this.quantity).subscribe({
      next: () => {
        console.log('Added to cart:', this.product!.id, 'Quantity:', this.quantity);
      },
      error: (err) => {
        console.error("Error adding to cart:", err);
      }
    });
  }

  // ✅ Navigate back
  goBack(): void {
    this.router.navigate(['/']);
  }
}
