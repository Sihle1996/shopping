import { Component, OnInit } from '@angular/core';
import { FavouriteService, FavouriteItem } from 'src/app/services/favourite.service';
import { Router } from '@angular/router';
import { ProductCardItem } from 'src/app/shared/components/product-card/product-card.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-favourites',
  templateUrl: './favourites.component.html'
})
export class FavouritesComponent implements OnInit {
  items: FavouriteItem[] = [];
  loading = true;

  constructor(private favouriteService: FavouriteService, private router: Router) {}

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

  goBack(): void {
    const slug = localStorage.getItem('storeSlug');
    if (slug) this.router.navigate(['/store', slug]);
    else this.router.navigate(['/']);
  }
}
