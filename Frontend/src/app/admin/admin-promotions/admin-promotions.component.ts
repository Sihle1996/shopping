import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminPromotionService, PromotionRequest } from 'src/app/services/admin-promotion.service';
import { AdminService } from 'src/app/services/admin.service';
import { Promotion, getPromoStatus, PromoStatus } from 'src/app/services/promotion.service';
import { environment } from 'src/environments/environment';

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

  showDeleteConfirm = false;
  deleteTarget: Promotion | null = null;
  imageUploading = false;
  imagePreviewUrl: string = '';

  appliesToOptions = [
    { value: 'ALL', label: 'All Products' },
    { value: 'CATEGORY', label: 'Category' },
    { value: 'PRODUCT', label: 'Product' },
  ];

  categories: any[] = [];
  menuItems: any[] = [];

  get selectedAppliesTo(): string {
    return this.form?.get('appliesTo')?.value;
  }

  /** Only available (in-stock) products shown in PRODUCT promo dropdown */
  get availableMenuItems(): any[] {
    return this.menuItems.filter(i => i.isAvailable !== false);
  }

  /** Only categories that have at least one in-stock item */
  get availableCategories(): any[] {
    return this.categories.filter(cat => {
      const catItems = this.menuItems.filter(i =>
        (i.category ?? '').toLowerCase() === (cat.name ?? '').toLowerCase()
      );
      return catItems.some(i => i.isAvailable !== false);
    });
  }

  constructor(
    private fb: FormBuilder,
    private api: AdminPromotionService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      imageUrl: [''],
      badgeText: [''],
      discountPercent: [null, [Validators.min(0), Validators.max(100)]],
      startAt: ['', Validators.required],
      endAt: ['', Validators.required],
      appliesTo: ['ALL', Validators.required],
      targetCategoryId: [null],
      targetProductId: [null],
      code: [''],
      active: [true],
      featured: [false],
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

  submit(): void {
    if (this.form.invalid) return;
    const raw = this.form.value;

    // datetime-local gives local time "2026-03-28T19:58" — append local UTC offset
    const toIso = (dt: string): string => {
      if (!dt || dt.length !== 16) return dt;
      const d = new Date(dt);
      const off = -d.getTimezoneOffset(); // minutes ahead of UTC
      const sign = off >= 0 ? '+' : '-';
      const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
      const mm = String(Math.abs(off) % 60).padStart(2, '0');
      return `${dt}:00${sign}${hh}:${mm}`;
    };

    const payload: PromotionRequest = {
      ...raw,
      startAt: toIso(raw.startAt),
      endAt: toIso(raw.endAt),
    };

    const op = this.editingId
      ? this.api.update(this.editingId, payload)
      : this.api.create(payload);

    op.subscribe({
      next: () => { this.resetForm(); this.refresh(); },
    });
  }

  edit(p: Promotion): void {
    this.editingId = p.id;
    this.imagePreviewUrl = p.imageUrl || '';
    this.form.patchValue({
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl,
      badgeText: p.badgeText,
      discountPercent: p.discountPercent ?? null,
      startAt: p.startAt?.substring(0, 16),
      endAt: p.endAt?.substring(0, 16),
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
    this.imagePreviewUrl = '';
    this.form.reset({ appliesTo: 'ALL', active: true, featured: false });
  }

  confirmDelete(p: Promotion): void {
    this.deleteTarget = p;
    this.showDeleteConfirm = true;
  }

  onDeleteConfirmed(): void {
    if (this.deleteTarget) {
      this.api.delete(this.deleteTarget.id).subscribe({ next: () => this.refresh() });
    }
    this.onDeleteCancelled();
  }

  onDeleteCancelled(): void {
    this.showDeleteConfirm = false;
    this.deleteTarget = null;
  }

  toggleActive(p: Promotion): void {
    this.api.setActive(p.id, !p.active).subscribe({ next: () => this.refresh() });
  }

  toggleFeatured(p: Promotion): void {
    this.api.setFeatured(p.id, !p.featured).subscribe({ next: () => this.refresh() });
  }

  getStatus(p: Promotion): PromoStatus {
    return getPromoStatus(p);
  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => { this.imagePreviewUrl = e.target?.result as string; };
    reader.readAsDataURL(file);

    this.imageUploading = true;
    const formData = new FormData();
    formData.append('file', file);
    this.adminService.uploadImage(formData).subscribe({
      next: (url: string) => {
        this.form.patchValue({ imageUrl: url });
        // Keep the local base64 preview — don't replace with server URL
        // which may require auth or be a relative path
        this.imageUploading = false;
      },
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
}
