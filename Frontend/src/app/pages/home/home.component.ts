import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { CartService } from 'src/app/services/cart.service';
import { MenuService } from 'src/app/services/menu.service';
import { ProductService } from 'src/app/services/product.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  menuItems: any[] = [];
  filteredMenuItems: any[] = [];
  categories = [
    { name: 'Pizzas', icon: 'assets/icons/pizza.png' },
    { name: 'Burgers', icon: 'assets/icons/burger.png' },
    { name: 'Desserts', icon: 'assets/icons/dessert.png' }
  ];
  selectedCategory = '';
  searchQuery = '';
  selectedSort = '';
  isLoggedIn = false;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.productService.getMenuItems().subscribe(items => {
      this.menuItems = items;
      this.filteredMenuItems = [...this.menuItems];
    });
  }

  // ✅ Redirect to Product Details Page
  goToProductDetails(productId: number): void {
    this.router.navigate(['/product', productId]);
  }

  // ✅ Handle add to cart without redirecting
  addToCart(itemId: number): void {
    const userId = Number(localStorage.getItem('userId')); // Get user ID from localStorage
  
    if (!userId) {
      console.error("User not logged in.");
      this.router.navigate(['/login']); // Redirect to login if not logged in
      return;
    }
  
    const quantity = 1; // Default quantity
  
    this.cartService.addToCart(userId, itemId, quantity).subscribe({
      next: () => {
        console.log('Item added to cart:', itemId);
      },
      error: (err) => {
        console.error("Error adding item to cart:", err);
      }
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

  // ✅ Sort Menu Items
  sortMenu() {
    if (this.selectedSort === 'priceLowHigh') {
      this.filteredMenuItems.sort((a, b) => a.price - b.price);
    } else if (this.selectedSort === 'priceHighLow') {
      this.filteredMenuItems.sort((a, b) => b.price - a.price);
    }
  }
}
