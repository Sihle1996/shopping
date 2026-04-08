import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { CartService } from 'src/app/services/cart.service';
import { MenuItem, MenuService } from 'src/app/services/menu.service';
import { PromotionService } from 'src/app/services/promotion.service';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-product',
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss']
})
export class ProductComponent implements OnInit {
  product: MenuItem | null = null;
  relatedItems: MenuItem[] = [];
  quantity = 1;
  isAddingToCart = false;
  activePromotions: any[] = [];
  showOutOfStockModal = false;
  showAddedBanner = false;
  isFavourite = false;
  modifierGroups: any[] = [];
  modifierSelections: { [groupId: string]: string[] } = {};
  modifierLoading = false;
  itemNotes = '';
  reviews: any[] = [];
  avgRating = 0;
  totalReviews = 0;

  private addedBannerTimer: any;
  private slug: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private menuService: MenuService,
    private cartService: CartService,
    private promotionService: PromotionService,
    private router: Router,
    private location: Location,
    private toastr: ToastrService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.slug = localStorage.getItem('storeSlug');
    this.route.paramMap.subscribe(params => {
      const productId = params.get('id');
      if (!productId) { this.router.navigate(['/']); return; }
      this.loadProduct(productId);
    });
    this.promotionService.getActivePromotions().subscribe({
      next: list => this.activePromotions = list,
      error: () => {}
    });
    this.loadReviews();
  }

  private loadReviews(): void {
    const tenantId = localStorage.getItem('tenantId');
    const headers: any = tenantId ? { 'X-Tenant-Id': tenantId } : {};
    this.http.get<any>(`${environment.apiUrl}/api/reviews`, { headers }).subscribe({
      next: res => {
        this.reviews = (res.reviews ?? res ?? []).slice(0, 4);
        this.avgRating = res.averageRating ?? 0;
        this.totalReviews = res.totalReviews ?? this.reviews.length;
      },
      error: () => {}
    });
  }

  private loadProduct(productId: string): void {
    this.product = null;
    this.relatedItems = [];
    this.modifierGroups = [];
    this.modifierSelections = {};

    this.menuService.getProductById(productId).subscribe({
      next: product => {
        this.product = product;
        this.isFavourite = this.getFavourites().includes(productId);
        this.loadModifiers(productId);
        this.loadRelated(product);
      },
      error: () => this.router.navigate(['/'])
    });
  }

  private loadModifiers(productId: string): void {
    const tenantId = localStorage.getItem('tenantId');
    const headers: any = tenantId ? { 'X-Tenant-Id': tenantId } : {};
    this.modifierLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/menu/${productId}/option-groups`, { headers }).subscribe({
      next: groups => {
        this.modifierGroups = groups || [];
        this.modifierSelections = {};
        for (const g of this.modifierGroups) {
          if (g.type === 'RADIO' && g.choices?.length) {
            this.modifierSelections[g.id] = [g.choices[0].id];
          }
        }
        this.modifierLoading = false;
      },
      error: () => { this.modifierGroups = []; this.modifierLoading = false; }
    });
  }

  private loadRelated(product: MenuItem): void {
    this.menuService.getMenuItems().subscribe({
      next: items => {
        this.relatedItems = items
          .filter(i => i.id !== product.id && i.category === product.category && i.isAvailable)
          .slice(0, 4);
      },
      error: () => {}
    });
  }

  get autoDiscountPercent(): number {
    if (!this.product || !this.activePromotions.length) return 0;
    let best = 0;
    for (const p of this.activePromotions) {
      if (p.code || !p.discountPercent) continue;
      if (p.appliesTo === 'ALL') best = Math.max(best, p.discountPercent);
      else if (p.appliesTo === 'PRODUCT' && p.targetProductId === this.product.id) best = Math.max(best, p.discountPercent);
      else if (p.appliesTo === 'CATEGORY' && p.targetCategoryName && (this.product.category ?? '').toLowerCase() === p.targetCategoryName.toLowerCase()) best = Math.max(best, p.discountPercent);
    }
    return best;
  }

  get modifierExtra(): number {
    let extra = 0;
    for (const g of this.modifierGroups) {
      const selectedIds = this.modifierSelections[g.id] || [];
      for (const c of g.choices || []) {
        if (selectedIds.includes(c.id)) extra += c.priceModifier || 0;
      }
    }
    return extra;
  }

  get unitPrice(): number {
    return (this.product?.price || 0) + this.modifierExtra;
  }

  get lineTotal(): number {
    return this.unitPrice * this.quantity;
  }

  get discountedTotal(): number {
    if (!this.autoDiscountPercent) return this.lineTotal;
    return this.lineTotal * (1 - this.autoDiscountPercent / 100);
  }

  get requiredSatisfied(): boolean {
    return this.modifierGroups.filter(g => g.required).every(g => (this.modifierSelections[g.id] || []).length > 0);
  }

  toggleChoice(group: any, choiceId: string): void {
    if (group.type === 'RADIO') {
      this.modifierSelections[group.id] = [choiceId];
    } else {
      const current = this.modifierSelections[group.id] || [];
      const idx = current.indexOf(choiceId);
      this.modifierSelections[group.id] = idx >= 0 ? current.filter(id => id !== choiceId) : [...current, choiceId];
    }
  }

  isChoiceSelected(groupId: string, choiceId: string): boolean {
    return (this.modifierSelections[groupId] || []).includes(choiceId);
  }

  addToCart(): void {
    if (!this.product?.id) return;
    if (!this.product.isAvailable) { this.showOutOfStockModal = true; return; }
    if (!this.requiredSatisfied) { this.toastr.warning('Please make all required selections'); return; }

    const choices: any[] = [];
    for (const g of this.modifierGroups) {
      const selectedIds = this.modifierSelections[g.id] || [];
      for (const c of g.choices || []) {
        if (selectedIds.includes(c.id)) {
          choices.push({ groupName: g.name, choiceLabel: c.label, priceModifier: c.priceModifier || 0 });
        }
      }
    }

    this.isAddingToCart = true;
    this.cartService.addToCart(
      this.product.id, this.quantity, null,
      choices.length ? JSON.stringify(choices) : null,
      { name: this.product.name, price: this.unitPrice, category: this.product.category, image: this.product.image },
      this.itemNotes || null
    ).subscribe({
      next: () => {
        this.isAddingToCart = false;
        clearTimeout(this.addedBannerTimer);
        this.showAddedBanner = true;
        this.addedBannerTimer = setTimeout(() => this.showAddedBanner = false, 3000);
      },
      error: err => { this.toastr.error(err?.error || 'Failed to add item'); this.isAddingToCart = false; }
    });
  }

  goToRelated(id: string | null): void {
    if (!id) return;
    this.router.navigate(this.slug ? ['/store', this.slug, 'product', id] : ['/product', id]);
  }

  toggleFavourite(): void {
    if (!this.product?.id) return;
    const favs = this.getFavourites();
    const idx = favs.indexOf(this.product.id);
    if (idx >= 0) { favs.splice(idx, 1); this.isFavourite = false; }
    else { favs.push(this.product.id); this.isFavourite = true; }
    localStorage.setItem('favourites', JSON.stringify(favs));
  }

  private getFavourites(): string[] {
    try { return JSON.parse(localStorage.getItem('favourites') || '[]'); } catch { return []; }
  }

  get cartRoute(): string {
    return this.slug ? `/store/${this.slug}/cart` : '/cart';
  }

  goBack(): void { this.location.back(); }

  getImageUrl(path?: string): string {
    if (!path) return 'assets/placeholder.png';
    return path.startsWith('http') ? path : `${environment.apiUrl}${path}`;
  }
}
