import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { CartService } from 'src/app/services/cart.service';
import { MenuItem, MenuService } from 'src/app/services/menu.service';
import { AuthService } from 'src/app/services/auth.service';
import { PromotionService } from 'src/app/services/promotion.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-product',
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss']
})
export class ProductComponent implements OnInit {
  product: MenuItem | null = null;
  quantity = 1;
  selectedSize = 'M';
  isAddingToCart = false;
  autoDiscountPercent = 0;

  constructor(
    private route: ActivatedRoute,
    private menuService: MenuService,
    private cartService: CartService,
    private authService: AuthService,
    private promotionService: PromotionService,
    private router: Router,
    private location: Location,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    const productId = this.route.snapshot.paramMap.get('id');
    if (!productId) {
      this.router.navigate(['/']);
      return;
    }

    this.menuService.getProductById(productId).subscribe({
      next: (product) => this.product = product,
      error: () => this.router.navigate(['/'])
    });

    this.promotionService.getActivePromotions().subscribe({
      next: (list) => {
        const auto = list.find(p => !p.code && p.appliesTo === 'ALL' && p.discountPercent);
        this.autoDiscountPercent = auto?.discountPercent ?? 0;
      },
      error: () => {}
    });
  }

  get discountedPrice(): number {
    if (!this.product) return 0;
    const base = this.product.price * this.quantity;
    if (!this.autoDiscountPercent) return base;
    return base * (1 - this.autoDiscountPercent / 100);
  }

  addToCart(): void {
    if (!this.product?.id) return;

    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.isAddingToCart = true;
    this.cartService.addToCart(this.product.id, this.quantity, this.selectedSize).subscribe({
      next: () => {
        this.toastr.success(`${this.product!.name} added to cart`);
        this.isAddingToCart = false;
      },
      error: () => {
        this.toastr.error('Failed to add item to cart');
        this.isAddingToCart = false;
      }
    });
  }

  goBack(): void {
    this.location.back();
  }

  selectSize(size: string): void {
    this.selectedSize = size;
  }

  getSizeClasses(size: string): string {
    const base = 'w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 active:scale-95';
    return this.selectedSize === size
      ? `${base} bg-primary text-white shadow-sm`
      : `${base} border-2 border-borderColor text-textDark hover:border-primary hover:text-primary`;
  }

  getImageUrl(path?: string): string {
    if (!path) return 'assets/placeholder.png';
    return path.startsWith('http') ? path : `${environment.apiUrl}${path}`;
  }
}
