import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/services/admin.service';

@Component({
  selector: 'app-admin-menu',
  templateUrl: './admin-menu.component.html',
  styleUrls: ['./admin-menu.component.scss']
})
export class AdminMenuComponent implements OnInit {
  menuItems: any[] = [];
  showForm = false;
  isEditing = false;
  searchQuery = '';
  selectedSort = 'default';
  selectedCategory = 'All';
  categories: string[] = [];

  formData = {
    id: null,
    name: '',
    description: '',
    price: 0,
    image: '',
    category: '',
    isAvailable: true
  };

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.fetchMenuItems();
  }

  fetchMenuItems(): void {
    this.adminService.getMenuItems().subscribe({
      next: data => {
        this.menuItems = data;
        this.categories = ['All', ...Array.from(new Set<string>((data.map((item: any) => item.category))))];


      },
      error: err => console.error('Failed to fetch menu items:', err)
    });
  }

  get filteredMenu(): any[] {
    return this.menuItems
      .filter(item => {
        const matchesCategory = this.selectedCategory === 'All' || item.category === this.selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(this.searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (this.selectedSort === 'priceLowHigh') return a.price - b.price;
        if (this.selectedSort === 'priceHighLow') return b.price - a.price;
        return 0;
      });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) this.resetForm();
  }

  submitForm(): void {
    if (!this.formData.name || !this.formData.price || !this.formData.category) {
      alert('Name, price and category are required!');
      return;
    }

    const action = this.isEditing
      ? this.adminService.updateMenuItem(this.formData.id!, this.formData)
      : this.adminService.createMenuItem(this.formData);

    action.subscribe({
      next: () => {
        this.fetchMenuItems();
        this.toggleForm();
      },
      error: err => console.error('Error saving menu item:', err)
    });
  }

  editItem(item: any): void {
    this.formData = { ...item };
    this.showForm = true;
    this.isEditing = true;
  }

  deleteItem(id: number): void {
    if (confirm('Are you sure you want to delete this item?')) {
      this.adminService.deleteMenuItem(id).subscribe({
        next: () => this.fetchMenuItems(),
        error: err => console.error('Error deleting item:', err)
      });
    }
  }

  filterByCategory(category: string): void {
    this.selectedCategory = category;
  }

  private resetForm(): void {
    this.formData = {
      id: null,
      name: '',
      description: '',
      price: 0,
      image: '',
      category: '',
      isAvailable: true
    };
    this.isEditing = false;
  }
}
