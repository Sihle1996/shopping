import { Component } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { AdminService } from 'src/app/services/admin.service';
import { MenuService, MenuItem } from 'src/app/services/menu.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  menuItems: MenuItem[] = [];
  filteredMenuItems: MenuItem[] = [];
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

  constructor(
    private authService: AuthService,
    private menuService: MenuService,
    private adminService: AdminService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.getUserRole() === 'ROLE_ADMIN';
    this.isLoggedIn = this.authService.isLoggedIn();
    this.fetchMenu();
  }

  fetchMenu(): void {
    if (this.isAdmin) {
      this.adminService.menuItems$.subscribe((data: any[]) => {
        this.menuItems = data;
        this.filteredMenuItems = data;
      });
      this.adminService.loadMenuItems().subscribe({
        error: (err: unknown) => console.error('❌ Failed to load menu:', err)
      });
    } else {
        this.menuService.getMenuItems().subscribe({
          next: (data: any[]) => {
            this.menuItems = data;
            this.filteredMenuItems = data;
          },
          error: (err: unknown) => console.error('❌ Failed to load menu:', err)
        });
      }
  }

  filterMenu(): void {
    this.filteredMenuItems = this.menuItems.filter(item =>
      item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  filterByCategory(category: string): void {
    this.selectedCategory = category;
    this.filteredMenuItems = category === 'All'
      ? this.menuItems
      : this.menuItems.filter(item => item.category === category);
  }

  sortMenu(): void {
    if (this.selectedSort === 'priceLowHigh') {
      this.filteredMenuItems.sort((a, b) => a.price - b.price);
    } else if (this.selectedSort === 'priceHighLow') {
      this.filteredMenuItems.sort((a, b) => b.price - a.price);
    }
  }

  goToProductDetails(productId: number | null): void {
    if (productId !== null) {
      this.router.navigate(['/product', productId]);
    }
  }

  toggleFavorite(item: MenuItem): void {
    console.log("💖 Favorite clicked for:", item.name);
    // Add future favorite logic here
  }

  getImageUrl(path: string | null): string {
    if (!path) return 'assets/placeholder.png'; // fallback if null or empty
    return path.startsWith('http') ? path : `http://localhost:8080${path}`;
  }
  
  
}
