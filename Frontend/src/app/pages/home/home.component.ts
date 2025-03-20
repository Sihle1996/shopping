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
  categories = [
    { name: 'Pizzas', icon: 'assets/icons/pizza.png' },
    { name: 'Burgers', icon: 'assets/icons/burger.png' },
    { name: 'Desserts', icon: 'assets/icons/dessert.png' }
  ];
  selectedCategory = '';
  searchQuery = '';
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

  // ✅ Handle add to cart
  addToCart(item: MenuItem): void {
    const userIdString = localStorage.getItem('userId');
    const userId = userIdString ? Number(userIdString) : null;
  
    if (!userId || isNaN(userId)) {
      console.error("User not logged in.");
      this.router.navigate(['/login']);
      return;
    }
  
    const quantity = 1; // Default quantity
  
    this.cartService.addToCart(userId, item.id, quantity).subscribe({
      next: () => console.log('Item added to cart:', item.id),
      error: (err) => console.error("Error adding item to cart:", err)
    });
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
}
