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
    this.adminService.menuItems$.subscribe(data => {
      this.menuItems = data;
      this.categories = ['All', ...Array.from(new Set<string>(data.map((item: any) => item.category)))];
    });
    this.fetchMenuItems();
  }

  fetchMenuItems(): void {
    this.adminService.loadMenuItems().subscribe({
      error: (err: unknown) => console.error('Failed to fetch menu items:', err)
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

    if (this.isEditing) {
      this.adminService.updateMenuItem(this.formData.id!, this.formData);
    } else {
      this.adminService.createMenuItem(this.formData);
    }
    this.toggleForm();
  }

  editItem(item: any): void {
    this.formData = { ...item };
    this.showForm = true;
    this.isEditing = true;
  }

  deleteItem(id: number): void {
    if (confirm('Are you sure you want to delete this item?')) {
      this.adminService.deleteMenuItem(id);
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

  onImageSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
  
      this.adminService.uploadImage(formData).subscribe({
        next: (url: string) => {
          this.formData.image = url;
        },
        error: (err: unknown) => console.error('Image upload failed', err)
      });
    }
  }
  
}
