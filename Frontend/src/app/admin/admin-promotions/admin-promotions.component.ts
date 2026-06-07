import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminPromotionService, PromotionRequest } from 'src/app/services/admin-promotion.service';
import { AdminService } from 'src/app/services/admin.service';
import { AdminAiService, AiPromoSuggestion } from 'src/app/services/admin-ai.service';
import { Promotion, getPromoStatus, PromoStatus } from 'src/app/services/promotion.service';
import { environment } from 'src/environments/environment';
import { ToastrService } from 'ngx-toastr';

type StatusFilter = 'All' | 'Active' | 'Scheduled' | 'Expired';

@Component({
  selector: 'app-admin-promotions',
  templateUrl: './admin-promotions.component.html',
  styleUrls: ['./admin-promotions.component.scss']
})
export class AdminPromotionsComponent implements OnInit {
  promotions: Promotion[] = [];
  form!: FormGroup;
  editingId: string | null = null;
  loading = false;
  submitting = false;
  submitError: string | null = null;
  formOpen = false;

  showDeleteConfirm = false;
  deleteTarget: Promotion | null = null;
  imageUploading = false;
  imagePreviewUrl: string = '';

  statusFilter: StatusFilter = 'All';
  statusTabs: StatusFilter[] = ['All', 'Active', 'Scheduled', 'Expired'];

  // AI suggestions
  aiSuggestions: AiPromoSuggestion[] = [];
  aiSuggestionsLoading = false;
  aiSuggestionsDismissed = new Set<number>();
  applyingIndex: number | null = null;

  // Multi-product selection
  selectedProductIds: string[] = [];
  productSearch = '';

  appliesToOptions = [
    { value: 'ALL',           label: 'All Products' },
    { value: 'CATEGORY',      label: 'Category' },
    { value: 'PRODUCT',       label: 'Single Product' },
    { value: 'MULTI_PRODUCT', label: 'Multiple Products' },
  ];

  categories: any[] = [];
  menuItems: any[] = [];

  get selectedAppliesTo(): string {
    return this.form?.get('appliesTo')?.value;
  }

  get availableMenuItems(): any[] {
    return this.menuItems.filter(i => i.isAvailable !== false);
  }

  get filteredMenuItemsForPicker(): any[] {
    const q = this.productSearch.toLowerCase();
    return this.availableMenuItems.filter(i =>
      !q || i.name.toLowerCase().includes(q) || (i.category ?? '').toLowerCase().includes(q)
    );
  }

  get availableCategories(): any[] {
    return this.categories.filter(cat => {
      const catItems = this.menuItems.filter(i =>
        (i.category ?? '').toLowerCase() === (cat.name ?? '').toLowerCase()
      );
      return catItems.some(i => i.isAvailable !== false);
    });
  }

  get filteredPromotions(): Promotion[] {
    if (this.statusFilter === 'All') return this.promotions;
    return this.promotions.filter(p => getPromoStatus(p) === this.statusFilter);
  }

  get statusCounts(): Record<StatusFilter, number> {
    return {
      All:       this.promotions.length,
      Active:    this.promotions.filter(p => getPromoStatus(p) === 'Active').length,
      Scheduled: this.promotions.filter(p => getPromoStatus(p) === 'Scheduled').length,
      Expired:   this.promotions.filter(p => getPromoStatus(p) === 'Expired').length,
    };
  }

  constructor(
    private fb: FormBuilder,
    private api: AdminPromotionService,
    private adminService: AdminService,
    private adminAiService: AdminAiService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      imageUrl: [''],
      badgeText: [''],
      discountPercent: [null, [Validators.min(1), Validators.max(100)]],
      startAt: ['', Validators.required],
      endAt: ['', Validators.required],
      appliesTo: ['ALL', Validators.required],
      targetCategoryId: [null],
      targetProductId: [null],
      code: [''],
      active: [true],
      featured: [false],
    }, {
      validators: (g: AbstractControl) => {
        const start = (g as FormGroup).get('startAt')?.value;
        const end = (g as FormGroup).get('endAt')?.value;
        return start && end && end <= start ? { dateOrder: true } : null;
      }
    });
    this.refresh();
    this.adminService.getCategories().subscribe({ next: (cats) => this.categories = cats, error: () => {} });
    this.adminService.loadMenuItems().subscribe({ next: (items) => this.menuItems = items, error: () => {} });
  }

  refresh(): void {
    this.loading = true;
    this.api.list().subscribe({
      next: (list) => { this.promotions = list; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openForm(): void {
    this.formOpen = true;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    if (this.selectedAppliesTo === 'MULTI_PRODUCT' && this.selectedProductIds.length === 0) {
      this.submitError = 'Please select at least one product.';
      return;
    }
    const raw = this.form.value;

    const payload: PromotionRequest = {
      ...raw,
      startAt: raw.startAt ? `${raw.startAt}T00:00:00+02:00` : raw.startAt,
      endAt:   raw.endAt   ? `${raw.endAt}T23:59:59+02:00`   : raw.endAt,
      targetProductIds: this.selectedAppliesTo === 'MULTI_PRODUCT' ? this.selectedProductIds : [],
    };

    const op = this.editingId
      ? this.api.update(this.editingId, payload)
      : this.api.create(payload);

    this.submitError = null;
    this.submitting = true;
    op.subscribe({
      next: () => {
        this.submitting = false;
        this.toastr.success(this.editingId ? 'Promotion updated' : 'Promotion created');
        this.resetForm();
        this.refresh();
      },
      error: (err) => {
        this.submitting = false;
        if (err?.status === 402) {
          this.submitError = err?.error?.message || 'Promotion limit reached for your plan. Upgrade to add more.';
        } else if (err?.status === 403) {
          this.submitError = err?.error?.message || 'This feature requires a higher plan.';
        } else {
          this.submitError = 'Something went wrong. Please try again.';
        }
      }
    });
  }

  edit(p: Promotion): void {
    this.editingId = p.id;
    this.formOpen = true;
    this.imagePreviewUrl = p.imageUrl || '';
    this.selectedProductIds = p.targetProducts?.map(tp => tp.id) ?? [];
    this.form.patchValue({
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl,
      badgeText: p.badgeText,
      discountPercent: p.discountPercent ?? null,
      startAt: p.startAt?.substring(0, 10),
      endAt: p.endAt?.substring(0, 10),
      appliesTo: p.appliesTo,
      targetCategoryId: p.targetCategoryId ?? null,
      targetProductId: p.targetProductId ?? null,
      code: p.code ?? '',
      active: p.active,
      featured: p.featured,
    });
  }

  resetForm(): void {
    this.editingId = null;
    this.formOpen = false;
    this.imagePreviewUrl = '';
    this.submitError = null;
    this.selectedProductIds = [];
    this.productSearch = '';
    this.form.reset({ appliesTo: 'ALL', active: true, featured: false });
  }

  toggleProductSelection(id: string): void {
    const idx = this.selectedProductIds.indexOf(id);
    if (idx >= 0) {
      this.selectedProductIds = this.selectedProductIds.filter(i => i !== id);
    } else {
      this.selectedProductIds = [...this.selectedProductIds, id];
    }
  }

  isProductSelected(id: string): boolean {
    return this.selectedProductIds.includes(id);
  }

  confirmDelete(p: Promotion): void {
    this.deleteTarget = p;
    this.showDeleteConfirm = true;
  }

  onDeleteConfirmed(): void {
    if (this.deleteTarget) {
      const target = this.deleteTarget;
      this.api.delete(target.id).subscribe({
        next: () => { this.toastr.success('Promotion deleted'); this.refresh(); },
        error: () => this.toastr.error('Failed to delete promotion')
      });
    }
    this.onDeleteCancelled();
  }

  onDeleteCancelled(): void {
    this.showDeleteConfirm = false;
    this.deleteTarget = null;
  }

  toggleActive(p: Promotion): void {
    this.api.setActive(p.id, !p.active).subscribe({
      next: () => { this.toastr.success(p.active ? 'Promotion paused' : 'Promotion activated'); this.refresh(); },
      error: () => this.toastr.error('Failed to update promotion')
    });
  }

  toggleFeatured(p: Promotion): void {
    this.api.setFeatured(p.id, !p.featured).subscribe({
      next: () => { this.toastr.success(p.featured ? 'Removed from featured' : 'Marked as featured'); this.refresh(); },
      error: () => this.toastr.error('Failed to update promotion')
    });
  }

  notifyingId: string | null = null;

  notifySubscribers(p: Promotion): void {
    this.notifyingId = p.id;
    this.api.notify(p.id).subscribe({
      next: (res) => {
        this.notifyingId = null;
        this.toastr.success(`Sent to ${res.sent} subscriber${res.sent !== 1 ? 's' : ''}`);
      },
      error: () => { this.notifyingId = null; this.toastr.error('Failed to send notifications'); }
    });
  }

  getStatus(p: Promotion): PromoStatus { return getPromoStatus(p); }

  loadAiSuggestions(): void {
    this.aiSuggestionsLoading = true;
    this.aiSuggestionsDismissed.clear();
    this.adminAiService.suggestPromotions().subscribe({
      next: (res) => { this.aiSuggestions = res.suggestions; this.aiSuggestionsLoading = false; },
      error: () => { this.aiSuggestionsLoading = false; this.toastr.error('AI suggestions unavailable'); }
    });
  }

  dismissSuggestion(index: number): void {
    this.aiSuggestionsDismissed.add(index);
  }

  applySuggestion(index: number): void {
    const s = this.aiSuggestions[index];
    if (!s) return;
    const p = s.proposedPromo;
    this.applyingIndex = index;
    const payload: PromotionRequest = {
      title: p.title,
      discountPercent: p.discountPercent,
      appliesTo: (p.appliesTo as any) || 'ALL',
      targetProductId: p.targetProductId || null,
      startAt: p.startAt ? `${p.startAt}T00:00:00+02:00` : new Date().toISOString(),
      endAt:   p.endAt   ? `${p.endAt}T23:59:59+02:00`   : new Date().toISOString(),
      active: true,
      featured: false,
    };
    this.api.create(payload).subscribe({
      next: () => {
        this.applyingIndex = null;
        this.aiSuggestionsDismissed.add(index);
        this.toastr.success(`Promotion "${p.title}" created`);
        this.refresh();
      },
      error: (err) => {
        this.applyingIndex = null;
        if (err?.status === 402 || err?.status === 403) {
          this.toastr.error(err?.error?.message || 'Plan limit reached');
        } else {
          this.toastr.error('Failed to create promotion');
        }
      }
    });
  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { this.imagePreviewUrl = e.target?.result as string; };
    reader.readAsDataURL(file);
    this.imageUploading = true;
    const formData = new FormData();
    formData.append('file', file);
    this.adminService.uploadImage(formData).subscribe({
      next: (url: string) => { this.form.patchValue({ imageUrl: url }); this.imageUploading = false; },
      error: () => { this.imageUploading = false; }
    });
  }

  resolveImageUrl(url: string | undefined): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${environment.apiUrl}${url}`;
  }

  getStatusVariant(p: Promotion): 'success' | 'warning' | 'neutral' {
    const s = getPromoStatus(p);
    if (s === 'Active') return 'success';
    if (s === 'Scheduled') return 'warning';
    return 'neutral';
  }

  getProductNameById(id: string): string {
    return this.availableMenuItems.find(i => i.id === id)?.name ?? id.substring(0, 8);
  }

  scopeLabel(p: Promotion): string {
    if (p.appliesTo === 'ALL') return 'All items';
    if (p.appliesTo === 'CATEGORY') return p.targetCategoryName || 'Category';
    if (p.appliesTo === 'PRODUCT') return p.targetProductName || 'Product';
    if (p.appliesTo === 'MULTI_PRODUCT') return `${p.targetProducts?.length ?? 0} products`;
    return p.appliesTo;
  }
}
