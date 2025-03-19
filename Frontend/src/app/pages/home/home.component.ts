import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { CartService } from 'src/app/services/cart.service';
import { MenuService } from 'src/app/services/menu.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  searchQuery = '';
  selectedCategory = 'All';
  menuItems: any[] = [];
  filteredMenuItems: any[] = [];
  isLoggedIn = false;

  categories = [
    { name: 'Pizzas', icon: 'assets/icons/pizza.png' },
    { name: 'Burgers', icon: 'assets/icons/burger.png' },
    { name: 'Desserts', icon: 'assets/icons/dessert.png' }
  ];

  constructor(private menuService: MenuService, private authService: AuthService) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    this.menuService.getMenuItems().subscribe(items => {
      this.menuItems = items;
      this.filteredMenuItems = items;
    });
  }

  filterMenu(): void {
    this.filteredMenuItems = this.menuItems.filter(item =>
      item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  filterByCategory(category: string): void {
    this.selectedCategory = category;
    if (category === 'All') {
      this.filteredMenuItems = this.menuItems;
    } else {
      this.filteredMenuItems = this.menuItems.filter(item => item.category === category);
    }
  }

  addToCart(itemId: number): void {
    // Logic to add item to cart
    console.log('Added to cart:', itemId);
  }
}
