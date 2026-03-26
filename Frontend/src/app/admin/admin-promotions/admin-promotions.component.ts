import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminPromotionService, PromotionRequest } from 'src/app/services/admin-promotion.service';
import { Promotion } from 'src/app/services/promotion.service';

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

  appliesToOptions = [
    { value: 'ALL', label: 'All Products' },
    { value: 'CATEGORY', label: 'Category' },
    { value: 'PRODUCT', label: 'Product' },
  ];

  constructor(private fb: FormBuilder, private api: AdminPromotionService) {}

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
    const payload: PromotionRequest = this.form.value;

    const op = this.editingId
      ? this.api.update(this.editingId, payload)
      : this.api.create(payload);

    op.subscribe({
      next: () => { this.resetForm(); this.refresh(); },
    });
  }

  edit(p: Promotion): void {
    this.editingId = p.id;
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
}
