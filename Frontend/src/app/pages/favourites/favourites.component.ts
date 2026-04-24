import { Component, OnInit } from '@angular/core';
import { FavouriteService, FavouriteItem } from 'src/app/services/favourite.service';
import { CartService } from 'src/app/services/cart.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProductCardItem } from 'src/app/shared/components/product-card/product-card.component';

@Component({
  selector: 'app-favourites',
  templateUrl: './favourites.component.html'
})
export class FavouritesComponent implements OnInit {
  items: FavouriteItem[] = [];
  loading = true;

  constructor(
    private favouriteService: FavouriteService,
    private cartService: CartService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.favouriteService.load().subscribe();
    this.favouriteService.getAll().subscribe({
      next: (items) => { this.items = items; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  toCardItem(f: FavouriteItem): ProductCardItem {
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      price: f.price,
      image: f.image,
      category: f.category,
      isAvailable: f.available
    };
  }

  goToProduct(item: ProductCardItem): void {
    const slug = localStorage.getItem('storeSlug');
    if (slug) this.router.navigate(['/store', slug, 'product', item.id]);
    else this.router.navigate(['/product', item.id]);
  }

  addToCart(item: ProductCardItem): void {
    if (!item.id) return;
    this.cartService.addToCart(item.id, 1, 'M', null, {
      name: item.name, price: item.price, category: item.category, image: item.image
    }).subscribe({
      next: () => this.toastr.success(`${item.name} added to cart`),
      error: (err) => this.toastr.error(err?.error || 'Failed to add to cart')
    });
  }

  onFavouriteToggled(item: ProductCardItem): void {
    if (!this.favouriteService.isFavourite(item.id!)) {
      this.items = this.items.filter(i => i.id !== item.id);
    }
  }

  goBack(): void {
    const slug = localStorage.getItem('storeSlug');
    if (slug) this.router.navigate(['/store', slug]);
    else this.router.navigate(['/']);
  }
}
