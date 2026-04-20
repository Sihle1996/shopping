import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

import { AuthService } from 'src/app/services/auth.service';
import { AdminService } from 'src/app/services/admin.service';
import { MenuService, MenuItem } from 'src/app/services/menu.service';
import { CartService, CartItem } from 'src/app/services/cart.service';
import { PromotionService, Promotion } from 'src/app/services/promotion.service';
import { TenantService } from 'src/app/services/tenant.service';
import { ProductCardItem } from 'src/app/shared/components/product-card/product-card.component';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

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
  autoDiscount = 0;  // kept for ALL promotions (used as default pass-through)
  isLoading = false;
  showOutOfStockModal = false;
  outOfStockItemName = '';
  cartAddedName = '';
  private cartAddedTimer: any;

  get categories(): { name: string; icon: string }[] {
    const unique = [...new Set(this.menuItems.map(i => (i as any).category).filter(Boolean))] as string[];
    return [
      { name: 'All', icon: '' },
      ...unique.map(name => ({ name, icon: '' }))
    ];
  }

  /** Stable field updated by applyFilters() — avoids new references every CD cycle. */
  filteredCategories: { name: string; items: MenuItem[] }[] = [];

  selectedCategory = 'All';
  selectedSort = 'default';
  searchQuery = '';

  isAdmin = false;
  isLoggedIn = false;
  storeIsOpen = true;

  // Cart state
  isCartOpen = false;
  cartItems: CartItem[] = [];
  cartItemCount = 0;
  cartTotal = 0;

  // Modifier modal state
  modifierModalOpen = false;
  modifierItem: ProductCardItem | null = null;
  modifierGroups: any[] = [];
  modifierSelections: { [groupId: string]: string[] } = {};
  modifierLoading = false;

  reviews: any[] = [];
  avgRating = 0;
  totalReviews = 0;
  estimatedDeliveryMinutes = 30;

  storeHours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; closed: boolean }> = [];
  showAllHours = false;
  readonly DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private menuService: MenuService,
    private adminService: AdminService,
    private cartService: CartService,
    private router: Router,
    private promotionService: PromotionService,
    private toastr: ToastrService,
    private http: HttpClient,
    private tenantService: TenantService
  ) {}

  // ── Modifier modal ────────────────────────────────────────────────────────

  private openModifierModal(item: ProductCardItem, groups: any[]): void {
    this.modifierItem = item;
    this.modifierGroups = groups;
    this.modifierSelections = {};
    // Pre-select first choice for RADIO groups
    for (const g of groups) {
      if (g.type === 'RADIO' && g.choices?.length) {
        this.modifierSelections[g.id] = [g.choices[0].id];
      }
    }
    this.modifierModalOpen = true;
  }

  closeModifierModal(): void {
    this.modifierModalOpen = false;
    this.modifierItem = null;
    this.modifierGroups = [];
    this.modifierSelections = {};
  }

  modifierToggleChoice(group: any, choiceId: string): void {
    if (group.type === 'RADIO') {
      this.modifierSelections[group.id] = [choiceId];
    } else {
      const current = this.modifierSelections[group.id] || [];
      const idx = current.indexOf(choiceId);
      this.modifierSelections[group.id] = idx >= 0
        ? current.filter(id => id !== choiceId)
        : [...current, choiceId];
    }
  }

  isChoiceSelected(groupId: string, choiceId: string): boolean {
    return (this.modifierSelections[groupId] || []).includes(choiceId);
  }

  get modifierTotal(): number {
    if (!this.modifierItem) return 0;
    let extra = 0;
    for (const g of this.modifierGroups) {
      const selectedIds = this.modifierSelections[g.id] || [];
      for (const c of g.choices || []) {
        if (selectedIds.includes(c.id)) extra += c.priceModifier || 0;
      }
    }
    return (this.modifierItem.price || 0) + extra;
  }

  get modifierRequiredSatisfied(): boolean {
    return this.modifierGroups
      .filter(g => g.required)
      .every(g => (this.modifierSelections[g.id] || []).length > 0);
  }

  confirmModifiers(): void {
    if (!this.authService.isLoggedIn()) {
      const slug = localStorage.getItem('storeSlug');
      this.router.navigate(['/login'], { queryParams: { returnUrl: slug ? `/store/${slug}` : '/' } });
      return;
    }
    if (!this.modifierItem || !this.modifierRequiredSatisfied) return;
    const choices: any[] = [];
    for (const g of this.modifierGroups) {
      const selectedIds = this.modifierSelections[g.id] || [];
      for (const c of g.choices || []) {
        if (selectedIds.includes(c.id)) {
          choices.push({ groupName: g.name, choiceLabel: c.label, priceModifier: c.priceModifier || 0 });
        }
      }
    }
    const selectedChoicesJson = JSON.stringify(choices);
    this.cartService.addToCart(this.modifierItem.id!, 1, 'M', selectedChoicesJson, {
      name: this.modifierItem.name,
      price: this.modifierItem.price || 0,
      category: this.modifierItem.category,
      image: this.modifierItem.image
    }).subscribe({
      next: () => {
        clearTimeout(this.cartAddedTimer);
        this.cartAddedName = this.modifierItem!.name;
        this.cartAddedTimer = setTimeout(() => this.cartAddedName = '', 3000);
        this.closeModifierModal();
      },
      error: (err) => this.toastr.error(err?.error || 'Failed to add item to cart')
    });
  }

  ngOnInit(): void {
    this.isAdmin = this.authService.getUserRole() === 'ROLE_ADMIN';
    this.isLoggedIn = this.authService.isLoggedIn();
    const tenant = this.tenantService.getCurrentTenant();
    if (tenant) {
      this.storeIsOpen = tenant.isOpen !== false;
      this.estimatedDeliveryMinutes = tenant.estimatedDeliveryMinutes || 30;
    }
    this.fetchMenu();
    this.loadPromotions();
    this.subscribeToCart();
    this.loadReviews();
    this.loadStoreHours();
  }

  private loadStoreHours(): void {
    const slug = localStorage.getItem('storeSlug');
    if (!slug) return;
    this.http.get<any[]>(`${environment.apiUrl}/api/tenants/${slug}/hours`).subscribe({
      next: hours => this.storeHours = hours,
      error: () => {}
    });
  }

  get todayHours(): { dayOfWeek: number; openTime: string; closeTime: string; closed: boolean } | null {
    if (!this.storeHours.length) return null;
    // JS: 0=Sun,1=Mon…6=Sat  ISO: 1=Mon…7=Sun
    const jsDay = new Date().getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    return this.storeHours.find(h => h.dayOfWeek === isoDay) ?? null;
  }

  private loadReviews(): void {
    const tenantId = localStorage.getItem('tenantId');
    const headers: any = tenantId ? { 'X-Tenant-Id': tenantId } : {};
    this.http.get<any>(`${environment.apiUrl}/api/reviews`, { headers }).subscribe({
      next: (res) => {
        this.reviews = res.reviews ?? res ?? [];
        this.avgRating = res.averageRating ?? 0;
        this.totalReviews = res.totalReviews ?? this.reviews.length;
      },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.cartAddedTimer);
  }

  private subscribeToCart(): void {
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
    forkJoin({
      featured: this.promotionService.getFeaturedPromotion().pipe(catchError(() => of(null))),
      active: this.promotionService.getActivePromotions().pipe(catchError(() => of([])))
    }).pipe(takeUntil(this.destroy$))
      .subscribe(({ featured, active }) => {
        this.promotions = active;
        const autoAll = active.find((p: any) => !p.code && p.appliesTo === 'ALL' && p.discountPercent);
        this.autoDiscount = autoAll?.discountPercent ?? 0;
        // Use explicitly featured promo if present, else fall back to first active
        this.featuredPromotion = featured ?? (active.length > 0 ? active[0] : null);
      });
  }

  /** Returns promotions that are relevant to currently in-stock items */
  get visiblePromotions(): Promotion[] {
    return this.promotions.filter(p => this.isPromoRelevant(p));
  }

  private isPromoRelevant(p: Promotion): boolean {
    // If menu hasn't loaded yet, show everything — re-evaluated once items arrive
    if (!this.menuItems.length) return true;

    if (p.appliesTo === 'PRODUCT' && p.targetProductId) {
      const item = this.menuItems.find(i => i.id === p.targetProductId);
      if (!item) return true; // item not in current tenant's menu — leave visible
      return item.isAvailable !== false;
    }
    if (p.appliesTo === 'CATEGORY' && p.targetCategoryName) {
      const catName = p.targetCategoryName.toLowerCase();
      const catItems = this.menuItems.filter(i => (i.category ?? '').toLowerCase() === catName);
      if (!catItems.length) return true; // category has no items here — leave visible
      return catItems.some(i => i.isAvailable !== false);
    }
    return true; // ALL promotions always show
  }

  get isFeaturedPromoValid(): boolean {
    return this.featuredPromotion ? this.isPromoRelevant(this.featuredPromotion) : false;
  }

  getDiscountForItem(item: MenuItem): number {
    if (!this.promotions.length) return 0;
    // Find the best auto-applied (no code) discount for this specific item
    let best = 0;
    for (const p of this.promotions) {
      if (p.code || !p.discountPercent) continue; // skip code-based promos
      if (p.appliesTo === 'ALL') {
        best = Math.max(best, p.discountPercent);
      } else if (p.appliesTo === 'PRODUCT' && p.targetProductId === item.id) {
        best = Math.max(best, p.discountPercent);
      } else if (p.appliesTo === 'CATEGORY' && p.targetCategoryName && (item.category ?? '').toLowerCase() === p.targetCategoryName.toLowerCase()) {
        best = Math.max(best, p.discountPercent);
      } else if (p.appliesTo === 'MULTI_PRODUCT' && p.targetProducts?.some((tp: any) => tp.id === item.id)) {
        best = Math.max(best, p.discountPercent);
      }
    }
    return best;
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

  categoryItemCount(catName: string): number {
    if (catName === 'All') return this.menuItems.length;
    return this.menuItems.filter(i => (i as any).category === catName).length;
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

    // Update grouped categories — only when "All" is active and no search
    if (this.selectedCategory === 'All' && !this.searchQuery) {
      const unique = [...new Set(this.menuItems.map(i => (i as any).category).filter(Boolean))] as string[];
      this.filteredCategories = unique
        .map(name => ({ name, items: items.filter(i => (i as any).category === name) }))
        .filter(g => g.items.length > 0);
    } else {
      this.filteredCategories = [];
    }
  }

  goToProductDetails(item: ProductCardItem): void {
    if (item.id !== null) {
      const slug = localStorage.getItem('storeSlug');
      this.router.navigate(slug ? ['/store', slug, 'product', item.id] : ['/product', item.id]);
    }
  }

  get cartRoute(): string {
    const slug = localStorage.getItem('storeSlug');
    return slug ? `/store/${slug}/cart` : '/cart';
  }

  quickAddToCart(item: ProductCardItem): void {
    if (!item.id) return;
    if (!this.authService.isLoggedIn()) {
      const slug = localStorage.getItem('storeSlug');
      this.router.navigate(['/login'], { queryParams: { returnUrl: slug ? `/store/${slug}` : '/' } });
      return;
    }
    if (!item.isAvailable) {
      this.outOfStockItemName = item.name;
      this.showOutOfStockModal = true;
      return;
    }

    // Check for modifier groups loaded with the menu item
    const menuItem = this.menuItems.find(m => m.id === item.id) as any;
    const groups: any[] = menuItem?.optionGroups ?? [];
    if (groups.length > 0) {
      this.openModifierModal(item, groups);
      return;
    }
    this.addDirectToCart(item);
  }

  private addDirectToCart(item: ProductCardItem): void {
    this.cartService.addToCart(item.id!, 1, 'M', null, {
      name: item.name,
      price: item.price || 0,
      category: item.category,
      image: item.image
    }).subscribe({
      next: () => {
        clearTimeout(this.cartAddedTimer);
        this.cartAddedName = item.name;
        this.cartAddedTimer = setTimeout(() => this.cartAddedName = '', 3000);
      },
      error: (err) => this.toastr.error(err?.error || 'Failed to add item to cart')
    });
  }

  toggleFavorite(_item: ProductCardItem): void {
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
    const slug = localStorage.getItem('storeSlug');
    this.router.navigate(slug ? ['/store', slug, 'checkout'] : ['/checkout']);
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

  trackByName(_: number, group: { name: string }): string {
    return group.name;
  }
}
