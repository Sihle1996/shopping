import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { CartService } from 'src/app/services/cart.service';
import { MenuService, MenuItem } from 'src/app/services/menu.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  menuItems: MenuItem[] = [];
  filteredMenuItems: MenuItem[] = [];
  favoriteItems: Set<number> = new Set();
  categories = [
    { name: 'Pizzas', icon: 'assets/icons/pizza.png' },
    { name: 'Burgers', icon: 'assets/icons/burger.png' },
    { name: 'Desserts', icon: 'assets/icons/dessert.png' }
  ];
  selectedCategory = '';
  searchQuery = '';
  selectedSort = 'default';
  isLoggedIn = false;

  constructor(
    private menuService: MenuService,
    private cartService: CartService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.menuService.getMenuItems().subscribe(items => {
      this.menuItems = items;
      this.filteredMenuItems = [...this.menuItems];
    });
  }

  // ✅ Redirect to Product Details Page
  goToProductDetails(productId: number): void {
    this.router.navigate(['/product', productId]);
  }

  // ✅ Toggle Favorite Item (Add/Remove)
  toggleFavorite(item: MenuItem): void {
    if (this.favoriteItems.has(item.id)) {
      this.favoriteItems.delete(item.id);
    } else {
      this.favoriteItems.add(item.id);
    }
  }

  // ✅ Check if an item is in favorites
  isFavorite(item: MenuItem): boolean {
    return this.favoriteItems.has(item.id);
  }

  // ✅ Search functionality
  filterMenu() {
    this.filteredMenuItems = this.menuItems.filter(item =>
      item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  // ✅ Filter by category
  filterByCategory(category: string) {
    this.selectedCategory = category;
    this.filteredMenuItems = this.menuItems.filter(item => item.category === category);
  }

  // ✅ Sort Menu Items (Low to High, High to Low)
  sortMenu() {
    if (this.selectedSort === 'priceLowHigh') {
      this.filteredMenuItems.sort((a, b) => a.price - b.price);
    } else if (this.selectedSort === 'priceHighLow') {
      this.filteredMenuItems.sort((a, b) => b.price - a.price);
    } else {
      this.filteredMenuItems = [...this.menuItems]; // Reset sorting
    }
  }
}
