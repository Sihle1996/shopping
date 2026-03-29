import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/services/admin.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

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

  showDeleteConfirm = false;
  deleteTargetId: string | null = null;

  formData = {
    id: null,
    name: '',
    description: '',
    price: 0,
    image: '',
    category: '',
    isAvailable: true
  };

  constructor(private adminService: AdminService, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.adminService.menuItems$.subscribe((data: any[]) => {
      this.menuItems = data;
      this.categories = ['All', ...Array.from(new Set<string>(data.map((item: any) => item.category)))];
    });
    this.fetchMenuItems();
  }

  fetchMenuItems(): void {
    this.adminService.loadMenuItems().subscribe({
      error: () => {}
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
      this.toastr.warning('Name, price and category are required');
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

  confirmDelete(id: string): void {
    this.deleteTargetId = id;
    this.showDeleteConfirm = true;
  }

  onDeleteConfirmed(): void {
    if (this.deleteTargetId) {
      this.adminService.deleteMenuItem(this.deleteTargetId);
    }
    this.onDeleteCancelled();
  }

  onDeleteCancelled(): void {
    this.showDeleteConfirm = false;
    this.deleteTargetId = null;
  }

  filterByCategory(category: string): void {
    this.selectedCategory = category;
  }

  getImageUrl(item: any): string {
    if (!item.image) return 'assets/RedDot_Burger.jpg';
    if (item.image.startsWith('http')) return item.image;
    return `${environment.apiUrl}${item.image}`;
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
        error: () => {}
      });
    }
  }
  
}
