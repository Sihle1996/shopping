import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CartService } from 'src/app/services/cart.service';
import { ProductService } from 'src/app/services/product.service';

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.scss']
})
export class ProductDetailsComponent {
  product: any;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const productId = Number(this.route.snapshot.paramMap.get('id'));

    if (!productId) {
      console.error("Invalid product ID");
      return;
    }

    this.productService.getProductById(productId).subscribe({
      next: (product) => {
        this.product = product;
      },
      error: (err) => {
        console.error("Error fetching product:", err);
      }
    });
  }

  addToCart(): void {
    const userId = Number(localStorage.getItem('userId')); // Retrieve user ID from localStorage

    if (!userId) {
      console.error("User not logged in.");
      this.router.navigate(['/login']);
      return;
    }

    this.cartService.addToCart(userId, this.product.id, 1).subscribe({
      next: () => {
        console.log('Added to cart:', this.product.id);
      },
      error: (err) => {
        console.error("Error adding to cart:", err);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
