import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from 'src/app/services/auth.service';
import { AdminService } from 'src/app/services/admin.service';
import { MenuService, MenuItem } from 'src/app/services/menu.service';
import { CartService, CartItem } from 'src/app/services/cart.service';
import { PromotionService, Promotion } from 'src/app/services/promotion.service';
import { ProductCardItem } from 'src/app/shared/components/product-card/product-card.component';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  menuItems: MenuItem[] = [];
  filteredMenuItems: MenuItem[] = [];
  featuredPromotion: Promotion | null = null;
  promotions: Promotion[] = [];
  isLoading = false;

  categories = [
    { name: 'All', icon: 'assets/istockphoto-1419247070-612x612.jpg' },
    { name: 'Burgers', icon: 'assets/istockphoto-468676382-612x612.jpg' },
    { name: 'Pizza', icon: 'assets/photo-1513104890138-7c749659a591.jpg' },
    { name: 'Desserts', icon: 'assets/domino-s-pizza.jpg' },
    { name: 'Drinks', icon: 'assets/photo-1513104890138-7c749659a591.jpg' },
  ];

  selectedCategory = 'All';
  selectedSort = 'default';
  searchQuery = '';

  isAdmin = false;
  isLoggedIn = false;

  // Cart state
  isCartOpen = false;
  cartItems: CartItem[] = [];
  cartItemCount = 0;
  cartTotal = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private menuService: MenuService,
    private adminService: AdminService,
    private cartService: CartService,
    private router: Router,
    private promotionService: PromotionService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.getUserRole() === 'ROLE_ADMIN';
    this.isLoggedIn = this.authService.isLoggedIn();
    this.fetchMenu();
    this.loadPromotions();
    this.subscribeToCart();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToCart(): void {
    if (!this.isLoggedIn) return;

    this.cartService.getCartItemCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => this.cartItemCount = count);

    this.cartService.getTotalPrice()
      .pipe(takeUntil(this.destroy$))
      .subscribe(total => this.cartTotal = total);

    this.cartService.getCartItems()
      .pipe(takeUntil(this.destroy$))
      .subscribe(items => this.cartItems = items);
  }

  private loadPromotions(): void {
    this.promotionService.getFeaturedPromotion()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (p) => this.featuredPromotion = p,
        error: () => {}
      });

    this.promotionService.getActivePromotions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => this.promotions = list,
        error: () => {}
      });
  }

  fetchMenu(): void {
    this.isLoading = true;
    if (this.isAdmin) {
      this.adminService.menuItems$
        .pipe(takeUntil(this.destroy$))
        .subscribe((data: MenuItem[]) => {
          this.menuItems = data;
          this.applyFilters();
          this.isLoading = false;
        });
      this.adminService.loadMenuItems().subscribe({
        error: () => this.isLoading = false
      });
    } else {
      this.menuService.getMenuItems()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data: MenuItem[]) => {
            this.menuItems = data;
            this.applyFilters();
            this.isLoading = false;
          },
          error: () => this.isLoading = false
        });
    }
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.applyFilters();
  }

  filterByCategory(category: string): void {
    this.selectedCategory = category;
    this.applyFilters();
  }

  sortMenu(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedCategory = 'All';
    this.selectedSort = 'default';
    this.applyFilters();
  }

  private applyFilters(): void {
    let items = [...this.menuItems];

    // Category filter
    if (this.selectedCategory !== 'All') {
      items = items.filter(item => item.category === this.selectedCategory);
    }

    // Search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }

    // Sort
    if (this.selectedSort === 'priceLowHigh') {
      items.sort((a, b) => a.price - b.price);
    } else if (this.selectedSort === 'priceHighLow') {
      items.sort((a, b) => b.price - a.price);
    }

    this.filteredMenuItems = items;
  }

  goToProductDetails(item: ProductCardItem): void {
    if (item.id !== null) {
      this.router.navigate(['/product', item.id]);
    }
  }

  quickAddToCart(item: ProductCardItem): void {
    if (!item.id) return;
    this.cartService.addToCart(item.id, 1, 'M').subscribe({
      next: () => this.toastr.success(`${item.name} added to cart`),
      error: () => this.toastr.error('Failed to add item to cart')
    });
  }

  toggleFavorite(item: ProductCardItem): void {
    // Future favorite logic
  }

  // Cart drawer
  openCartDrawer(): void {
    this.isCartOpen = true;
  }

  closeCartDrawer(): void {
    this.isCartOpen = false;
  }

  goToCheckout(): void {
    this.isCartOpen = false;
    this.router.navigate(['/checkout']);
  }

  removeCartItem(itemId: string): void {
    this.cartService.removeFromCart(itemId).subscribe();
  }

  updateCartItemQuantity(event: { item: CartItem; quantity: number }): void {
    this.cartService.updateCartItem(event.item.id, event.quantity).subscribe();
  }

  trackById(_: number, item: MenuItem): string | null {
    return item.id;
  }
}
