import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminPromotionService, PromotionRequest } from 'src/app/services/admin-promotion.service';
import { AdminService } from 'src/app/services/admin.service';
import { AdminAiService, AiPromoSuggestion } from 'src/app/services/admin-ai.service';
import { Promotion, getPromoStatus, PromoStatus } from 'src/app/services/promotion.service';
import { environment } from 'src/environments/environment';
import { ToastrService } from 'ngx-toastr';
import { TabItem } from 'src/app/shared/components/tabbed-list/tabbed-list.component';

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

  /** Section tabs — split the page so the AI suggestion + outcome cards get their own clean space. */
  promoTab = 'promotions';
  get promoTabs(): TabItem[] {
    return [
      { key: 'promotions', label: 'Promotions' },
      { key: 'suggestions', label: 'Suggestions', count: this.aiSuggestions?.length || null },
      { key: 'performance', label: 'Performance', count: this.outcomes?.length || null },
    ];
  }
  /** Non-dismissed suggestions carrying their original index (so paginated apply/dismiss stay correct). */
  get visibleSuggestions(): { s: AiPromoSuggestion; i: number }[] {
    return this.aiSuggestions.map((s, i) => ({ s, i })).filter(x => !this.aiSuggestionsDismissed.has(x.i));
  }
  /** True once any suggestion carries observed prior-promo history — flips the intro banner. */
  get hasPromoHistory(): boolean {
    return this.aiSuggestions.some(s => !!s.analysis?.priorObserved);
  }
  // ── Performance filtering (within the tab) ──
  perfFilter = 'all';
  /** Classify an outcome so we can filter winners / losers / still-measuring. */
  outcomeBucket(o: any): 'win' | 'loss' | 'measuring' {
    const v = o?.scope === 'ALL' ? o.netRevenueLift : o?.netLiftPercent;
    const settled = o?.scope === 'ALL' ? o?.signal !== 'EARLY' : (o?.signal === 'MEASURED' || o?.signal === 'MEASURING');
    if (!settled || v == null) return 'measuring';
    return v > 0 ? 'win' : v < 0 ? 'loss' : 'measuring';
  }
  get perfTabs(): TabItem[] {
    const n = (k: string) => this.outcomes.filter(o => this.outcomeBucket(o) === k).length;
    return [
      { key: 'all', label: 'All', count: this.outcomes.length },
      { key: 'win', label: 'Winning', count: n('win') },
      { key: 'loss', label: 'Underperforming', count: n('loss') },
      { key: 'measuring', label: 'Measuring', count: n('measuring') },
    ];
  }
  private get filteredOutcomes(): any[] {
    return this.perfFilter === 'all' ? this.outcomes : this.outcomes.filter(o => this.outcomeBucket(o) === this.perfFilter);
  }
  /** Two different shapes of data — split + label them; both respect the active filter. */
  get storeWideOutcomes(): any[] { return this.filteredOutcomes.filter(o => o.scope === 'ALL'); }
  get itemOutcomes(): any[] { return this.filteredOutcomes.filter(o => o.scope !== 'ALL'); }
  /** Summary stays on ALL outcomes so the headline is stable regardless of the filter. */
  get totalNetLiftR(): number { return this.outcomes.filter(o => o.scope === 'ALL').reduce((sum, o) => sum + (o.netRevenueLift || 0), 0); }
  get positiveOutcomesCount(): number { return this.outcomes.filter(o => this.outcomeBucket(o) === 'win').length; }
  get measuredOutcomesCount(): number {
    return this.outcomes.filter(o => o.scope === 'ALL' || o.signal === 'MEASURED' || o.signal === 'MEASURING').length;
  }
  /** Left-accent colour for a suggestion's confidence tier. */
  tierBar(s?: string): string {
    return ({ STRONG: 'bg-emerald-400', MODERATE: 'bg-amber-400', WEAK: 'bg-gray-300' } as any)[s || ''] || 'bg-gray-300';
  }

  showDeleteConfirm = false;
  deleteTarget: Promotion | null = null;
  imageUploading = false;
  imagePreviewUrl: string = '';

  statusFilter: StatusFilter = 'All';
  statusTabs: StatusFilter[] = ['All', 'Active', 'Scheduled', 'Expired'];
  get statusTabItems(): TabItem[] {
    return this.statusTabs.map(t => ({ key: t, label: t, count: this.statusCounts[t] }));
  }

  // AI suggestions
  aiSuggestions: AiPromoSuggestion[] = [];
  aiSuggestionsLoading = false;
  aiSuggestionsDismissed = new Set<number>();
  aiSuggestionsReason = '';

  /** Colour for the STRONG/MODERATE/WEAK decision-gradient badge. */
  tierClass(s?: string): string {
    return ({
      STRONG: 'bg-emerald-100 text-emerald-700',
      MODERATE: 'bg-amber-100 text-amber-700',
      WEAK: 'bg-sky-100 text-sky-700'
    } as any)[s || ''] ?? 'bg-gray-100 text-gray-600';
  }
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

  rewardTypes = [
    { value: 'PERCENT_OFF',   label: '% off',         icon: 'bi-percent' },
    { value: 'AMOUNT_OFF',    label: 'R off',         icon: 'bi-cash-stack' },
    { value: 'FREE_DELIVERY', label: 'Free delivery', icon: 'bi-truck' },
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
      type: ['PERCENT_OFF', Validators.required],
      minSpend: [null, [Validators.min(0)]],
      discountAmount: [null, [Validators.min(1)]],
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
        const fg = g as FormGroup;
        const start = fg.get('startAt')?.value;
        const end = fg.get('endAt')?.value;
        if (start && end && end <= start) return { dateOrder: true };
        const type = fg.get('type')?.value;
        if (type === 'PERCENT_OFF' && !fg.get('discountPercent')?.value) return { rewardRequired: true };
        if (type === 'AMOUNT_OFF' && !fg.get('discountAmount')?.value) return { rewardRequired: true };
        return null;
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
    this.loadOutcomes();
  }

  // ── Experiment outcomes (the feedback loop) ──────────────────────────────
  outcomes: any[] = [];
  loadOutcomes(): void {
    this.adminAiService.promoOutcomes().subscribe({
      next: (r) => this.outcomes = r.outcomes || [],
      error: () => {}
    });
  }

  changeClass(pct: number | null): string {
    if (pct == null) return 'text-textMuted';
    return pct > 0 ? 'text-emerald-600' : pct < 0 ? 'text-red-600' : 'text-textMuted';
  }

  qualityClass(q?: string): string {
    return ({
      HIGH: 'bg-emerald-100 text-emerald-700',
      MEDIUM: 'bg-amber-100 text-amber-700',
      LOW: 'bg-gray-100 text-gray-600'
    } as any)[q || ''] ?? 'bg-gray-100 text-gray-600';
  }

  confidenceLabel(q?: string): string {
    return ({
      HIGH: 'High Confidence',
      MEDIUM: 'Medium Confidence',
      LOW: 'Low Confidence'
    } as any)[q || ''] ?? q;
  }

  signed(pct: number | null): string {
    return pct == null ? 'n/a' : (pct > 0 ? '+' : '') + pct + '%';
  }

  // ── V53.1 — ALL-scope Net Revenue Lift card helpers ──
  /** Signed rand, e.g. +R700 / -R531 / measuring… (null = not yet measurable). */
  randSigned(v: number | null): string {
    if (v == null) return 'measuring…';
    return (v > 0 ? '+R' : v < 0 ? '-R' : 'R') + Math.abs(v).toLocaleString('en-ZA');
  }
  /** Verdict badge: POSITIVE / NEGATIVE / INCONCLUSIVE (net lift > 0 / < 0 / not measurable). */
  liftStatus(o: any): string {
    if (o?.netRevenueLift == null) return 'INCONCLUSIVE';
    return o.netRevenueLift > 0 ? 'POSITIVE' : o.netRevenueLift < 0 ? 'NEGATIVE' : 'INCONCLUSIVE';
  }
  liftStatusClass(o: any): string {
    return ({ POSITIVE: 'bg-emerald-100 text-emerald-700', NEGATIVE: 'bg-red-100 text-red-700',
              INCONCLUSIVE: 'bg-gray-100 text-gray-600' } as any)[this.liftStatus(o)];
  }
  typeLabel(t?: string): string {
    return ({ FREE_DELIVERY: 'free delivery', AMOUNT_OFF: 'amount off', PERCENT_OFF: '% off' } as any)[t || ''] || 'promo';
  }

  openForm(): void {
    this.promoTab = 'promotions';
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
      type: p.type ?? 'PERCENT_OFF',
      minSpend: p.minSpend ?? null,
      discountAmount: p.discountAmount ?? null,
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
    this.form.reset({ appliesTo: 'ALL', type: 'PERCENT_OFF', active: true, featured: false });
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
      next: (res) => { this.aiSuggestions = res.suggestions; this.aiSuggestionsReason = (res as any).reason || ''; this.aiSuggestionsLoading = false; },
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
        this.promoTab = 'promotions';
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

  /** Human label for a promo's reward, e.g. "Free delivery over R200" / "R50 off over R300" / "20% off". */
  promoLabel(p: Promotion): string {
    const min = p.minSpend ? ` over R${p.minSpend}` : '';
    if (p.type === 'FREE_DELIVERY') return `Free delivery${min}`;
    if (p.type === 'AMOUNT_OFF') return `R${p.discountAmount ?? 0} off${min}`;
    return `${p.discountPercent ?? 0}% off${min}`;
  }
  rewardIcon(p: Promotion): string {
    if (p.type === 'FREE_DELIVERY') return 'bi-truck';
    if (p.type === 'AMOUNT_OFF') return 'bi-cash-stack';
    return 'bi-percent';
  }

  scopeLabel(p: Promotion): string {
    if (p.appliesTo === 'ALL') return 'All items';
    if (p.appliesTo === 'CATEGORY') return p.targetCategoryName || 'Category';
    if (p.appliesTo === 'PRODUCT') return p.targetProductName || 'Product';
    if (p.appliesTo === 'MULTI_PRODUCT') return `${p.targetProducts?.length ?? 0} products`;
    return p.appliesTo;
  }
}
