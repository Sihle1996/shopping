import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';
import { CartService } from 'src/app/services/cart.service';
import { MenuService, MenuItem } from 'src/app/services/menu.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  menuItems: any[] = [];
  filteredMenuItems: any[] = [];
  isAdmin: boolean = false;
  searchQuery: string = '';
  selectedCategory: string = 'All';
  selectedSort: string = 'default';
  showForm: boolean = false;
  isEditing: boolean = false;

  formData = {
    id: null,
    name: '',
    description: '',
    price: 0,
    category: '',
    image: ''
  };

  constructor(
    private authService: AuthService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.getUserRole() === 'ROLE_ADMIN';
    this.fetchMenu();
  }

  fetchMenu(): void {
    this.adminService.getMenuItems().subscribe({
      next: data => {
        this.menuItems = data;
        this.filteredMenuItems = data;
      }
    });
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

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) this.resetForm();
  }

  editItem(item: any): void {
    this.formData = { ...item };
    this.isEditing = true;
    this.showForm = true;
  }

  submitForm(): void {
    const action = this.isEditing
      ? this.adminService.updateMenuItem(this.formData.id!, this.formData)
      : this.adminService.createMenuItem(this.formData);

    action.subscribe({
      next: () => {
        this.fetchMenu();
        this.toggleForm();
      }
    });
  }

  deleteItem(id: number): void {
    if (confirm('Are you sure?')) {
      this.adminService.deleteMenuItem(id).subscribe(() => this.fetchMenu());
    }
  }

  resetForm(): void {
    this.formData = {
      id: null,
      name: '',
      description: '',
      price: 0,
      category: '',
      image: ''
    };
    this.isEditing = false;
  }
}
