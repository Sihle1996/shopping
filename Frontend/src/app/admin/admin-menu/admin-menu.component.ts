import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { driver } from 'driver.js';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-admin-menu',
  templateUrl: './admin-menu.component.html',
  styleUrls: ['./admin-menu.component.scss']
})
export class AdminMenuComponent implements OnInit, OnDestroy {
  menuItems: any[] = [];
  showForm = false;
  isEditing = false;
  searchQuery = '';
  selectedSort = 'default';
  selectedCategory = 'All';
  categories: any[] = [];       // objects: { id, name }
  filterCategories: string[] = ['All']; // names for the filter bar

  showDeleteConfirm = false;
  deleteTargetId: string | null = null;

  formData = {
    id: null,
    name: '',
    description: '',
    price: 0,
    image: '',
    category: '',
    isAvailable: true,
    stock: 0,
    lowStockThreshold: 5
  };

  menuFormSubmitted = false;

  // ── CSV import state ────────────────────────────────────────────────────
  importLoading = false;
  importResult: string | null = null;
  private activeDriver: any = null;

  // ── Bulk price edit state ────────────────────────────────────────────────
  bulkMode = false;
  selectedIds = new Set<string>();
  bulkAdjType: 'PERCENT' | 'FLAT' = 'PERCENT';
  bulkAdjValue = 0;
  bulkSaving = false;

  ngOnDestroy(): void {
    try { this.activeDriver?.destroy(); } catch { /* ignore */ }
  }

  // ── Option groups state ─────────────────────────────────────────────────
  expandedOptionsItemId: string | null = null;
  optionGroups: { [itemId: string]: any[] } = {};
  newGroupName: { [itemId: string]: string } = {};
  newGroupType: { [itemId: string]: string } = {};
  newGroupRequired: { [itemId: string]: boolean } = {};
  newChoiceLabel: { [groupId: string]: string } = {};
  newChoicePrice: { [groupId: string]: number } = {};
  optionsLoading: { [itemId: string]: boolean } = {};

  private get authHeaders(): HttpHeaders {
    const tenantId = localStorage.getItem('tenantId');
    const headers: any = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authService.getToken()}`
    };
    if (tenantId) headers['X-Tenant-Id'] = tenantId;
    return new HttpHeaders(headers);
  }

  constructor(
    private adminService: AdminService,
    private toastr: ToastrService,
    private http: HttpClient,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.adminService.menuItems$.subscribe((data: any[]) => {
      this.menuItems = data;
    });
    this.fetchMenuItems();
    const tour = this.route.snapshot.queryParamMap.get('tour');
    if (tour === 'add-item') {
      setTimeout(() => {
        const el = document.getElementById('add-menu-item-btn');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const d = driver({
            animate: true,
            overlayOpacity: 0.4,
            allowClose: true,
            overlayClickBehavior: 'close',
            onDestroyed: () => { this.activeDriver = null; }
          });
          this.activeDriver = d;
          d.highlight({
            element: '#add-menu-item-btn',
            popover: { title: 'Add Your First Item', description: 'Click here to add your first menu item and start building your menu', side: 'bottom', align: 'end', showButtons: ['close'] }
          });
        }, 400);
      }, 300);
    }
    this.adminService.getCategories().subscribe({
      next: (cats) => {
        this.categories = cats;
        this.filterCategories = ['All', ...cats.map((c: any) => c.name)];
      },
      error: () => {}
    });
  }

  fetchMenuItems(): void {
    this.adminService.loadMenuItems().subscribe({
      error: () => {}
    });
  }

  get filteredMenu(): any[] {
    return this.menuItems
      .filter(item => {
        const matchesCategory = this.selectedCategory === 'All' || item.category === this.selectedCategory || item.categoryName === this.selectedCategory;
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
    this.menuFormSubmitted = true;
    if (!this.formData.name?.trim() || !this.formData.category || !this.formData.price || this.formData.price <= 0) return;

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
    this.menuFormSubmitted = false;
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
    this.menuFormSubmitted = false;
    this.formData = {
      id: null,
      name: '',
      description: '',
      price: 0,
      image: '',
      category: '',
      isAvailable: true,
      stock: 0,
      lowStockThreshold: 5
    };
    this.isEditing = false;
  }

  onImageSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      this.adminService.uploadImage(formData).subscribe({
        next: (url: string) => { this.formData.image = url; },
        error: () => {}
      });
    }
  }

  // ── CSV import ────────────────────────────────────────────────────────────

  triggerCsvImport(): void {
    document.getElementById('csvImportInput')?.click();
  }

  onCsvSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;
    this.importLoading = true;
    this.importResult = null;
    const formData = new FormData();
    formData.append('file', file);
    this.http.post<any>(
      `${environment.apiUrl}/api/admin/menu/import-csv`,
      formData,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${this.authService.getToken()}` }) }
    ).subscribe({
      next: (res) => {
        this.importLoading = false;
        this.importResult = `${res.created} items imported, ${res.skipped} skipped`;
        if (res.created > 0) {
          this.toastr.success(`${res.created} items imported`);
          this.fetchMenuItems();
        } else {
          this.toastr.warning('No items were imported');
        }
        event.target.value = '';
      },
      error: () => {
        this.importLoading = false;
        this.toastr.error('CSV import failed');
        event.target.value = '';
      }
    });
  }

  // ── Bulk price edit ────────────────────────────────────────────────────────

  toggleBulkMode(): void {
    this.bulkMode = !this.bulkMode;
    if (!this.bulkMode) this.clearBulkSelection();
  }

  toggleSelect(id: string): void {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  selectAll(): void {
    this.filteredMenu.forEach(item => this.selectedIds.add(item.id));
  }

  clearBulkSelection(): void {
    this.selectedIds.clear();
    this.bulkAdjValue = 0;
    this.bulkAdjType = 'PERCENT';
  }

  applyBulkPrice(): void {
    if (this.selectedIds.size === 0 || !this.bulkAdjValue) return;
    this.bulkSaving = true;
    const body = { ids: Array.from(this.selectedIds), type: this.bulkAdjType, value: this.bulkAdjValue };
    this.http.patch(
      `${environment.apiUrl}/api/admin/menu/bulk-price`,
      body,
      { headers: this.authHeaders }
    ).subscribe({
      next: () => {
        this.toastr.success(`${this.selectedIds.size} item(s) updated`);
        this.bulkSaving = false;
        this.clearBulkSelection();
        this.fetchMenuItems();
      },
      error: () => {
        this.toastr.error('Bulk price update failed');
        this.bulkSaving = false;
      }
    });
  }

  // ── Option groups ──────────────────────────────────────────────────────────

  toggleOptions(item: any): void {
    if (this.expandedOptionsItemId === item.id) {
      this.expandedOptionsItemId = null;
      return;
    }
    this.expandedOptionsItemId = item.id;
    this.loadOptions(item.id);
  }

  loadOptions(itemId: string): void {
    this.optionsLoading[itemId] = true;
    this.http.get<any[]>(
      `${environment.apiUrl}/api/admin/menu-items/${itemId}/options`,
      { headers: this.authHeaders }
    ).subscribe({
      next: groups => { this.optionGroups[itemId] = groups; this.optionsLoading[itemId] = false; },
      error: () => { this.optionsLoading[itemId] = false; }
    });
  }

  addGroup(itemId: string): void {
    const name = (this.newGroupName[itemId] || '').trim();
    if (!name) return;
    const body = {
      name,
      type: this.newGroupType[itemId] || 'RADIO',
      required: this.newGroupRequired[itemId] || false
    };
    this.http.post(
      `${environment.apiUrl}/api/admin/menu-items/${itemId}/options`,
      body,
      { headers: this.authHeaders }
    ).subscribe({
      next: () => { this.newGroupName[itemId] = ''; this.loadOptions(itemId); },
      error: () => this.toastr.error('Failed to add option group')
    });
  }

  deleteGroup(itemId: string, groupId: string): void {
    this.http.delete(
      `${environment.apiUrl}/api/admin/menu-items/${itemId}/options/${groupId}`,
      { headers: this.authHeaders }
    ).subscribe({
      next: () => this.loadOptions(itemId),
      error: () => this.toastr.error('Failed to delete group')
    });
  }

  addChoice(itemId: string, groupId: string): void {
    const label = (this.newChoiceLabel[groupId] || '').trim();
    if (!label) return;
    const body = { label, priceModifier: this.newChoicePrice[groupId] || 0 };
    this.http.post(
      `${environment.apiUrl}/api/admin/menu-items/${itemId}/options/${groupId}/choices`,
      body,
      { headers: this.authHeaders }
    ).subscribe({
      next: () => { this.newChoiceLabel[groupId] = ''; this.newChoicePrice[groupId] = 0; this.loadOptions(itemId); },
      error: () => this.toastr.error('Failed to add choice')
    });
  }

  deleteChoice(itemId: string, groupId: string, choiceId: string): void {
    this.http.delete(
      `${environment.apiUrl}/api/admin/menu-items/${itemId}/options/${groupId}/choices/${choiceId}`,
      { headers: this.authHeaders }
    ).subscribe({
      next: () => this.loadOptions(itemId),
      error: () => this.toastr.error('Failed to delete choice')
    });
  }
}
