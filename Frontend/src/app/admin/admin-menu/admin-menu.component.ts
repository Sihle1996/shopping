import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, filter, takeUntil } from 'rxjs/operators';
import { driver } from 'driver.js';
import { AdminService } from 'src/app/services/admin.service';
import { AdminAiService } from 'src/app/services/admin-ai.service';
import { ConfirmService } from 'src/app/shared/services/confirm.service';
import { TabItem } from 'src/app/shared/components/tabbed-list/tabbed-list.component';
import { AuthService } from 'src/app/services/auth.service';
import { NotificationService } from 'src/app/services/notification.service';
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
  /** Category tabs (replaces the dropdown) — pick a category to see just those items, no long scroll.
   *  Derived from the items' ACTUAL categories (the defined-category list misses free-text ones), with counts. */
  get categoryTabs(): TabItem[] {
    const counts = new Map<string, number>();
    for (const i of this.menuItems) {
      const c = (i?.category || i?.categoryName || '').toString().trim();
      if (c) counts.set(c, (counts.get(c) || 0) + 1);
    }
    return [
      { key: 'All', label: 'All', count: this.menuItems.length },
      ...Array.from(counts.keys()).sort().map(c => ({ key: c, label: c, count: counts.get(c) })),
    ];
  }

  // Capability manifest (the SAME source the AI reads) — drives the form's options.
  capabilityCategories: string[] = [];
  menuHeadroom: { max: number; used: number; remaining: number } | null = null;

  showDeleteConfirm = false;
  deleteTargetId: string | null = null;

  formData = {
    id: null,
    name: '',
    description: '',
    price: 0,
    cost: null as number | null,
    image: '',
    category: '',
    isAvailable: true,
    stock: 0,
    lowStockThreshold: 5
  };

  menuFormSubmitted = false;
  aiGenerating = false;

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
    this.destroy$.next();
    this.destroy$.complete();
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

  private destroy$ = new Subject<void>();

  constructor(
    private adminService: AdminService,
    private adminAiService: AdminAiService,
    private toastr: ToastrService,
    private http: HttpClient,
    private authService: AuthService,
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    private confirm: ConfirmService
  ) {}

  ngOnInit(): void {
    this.adminService.menuItems$.subscribe((data: any[]) => {
      this.menuItems = data;
    });
    this.fetchMenuItems();
    this.notificationService.orderEvents
      .pipe(
        filter(e => e.type === 'ORDER_CREATED' || e.type === 'ORDER_CANCELLED'),
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.fetchMenuItems());
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
    this.loadCapabilities();
  }

  /** Read the capability manifest so the form offers the AI's exact categories + shows plan headroom. */
  private loadCapabilities(): void {
    this.adminAiService.capabilities('menu').subscribe({
      next: (mods) => {
        const menu = (mods || []).find((m: any) => m.module === 'menu');
        const create = menu?.actions?.find((a: any) => a.id === 'create_menu_item');
        const catField = create?.fields?.find((f: any) => f.name === 'category');
        this.capabilityCategories = catField?.options || [];
        this.menuHeadroom = create?.constraints?.planItems || null;
      },
      error: () => {}
    });
  }

  /** Categories for the add/edit form — the manifest/table list UNIONED with the categories items
   *  are actually in, so an existing item's category is always selectable and new items can join any
   *  real category even when the defined list lags behind reality (the bug where only "Burgers" showed). */
  get formCategories(): string[] {
    const base = this.capabilityCategories.length ? this.capabilityCategories : this.categories.map(c => c.name);
    const inUse = this.menuItems.map(i => (i?.category || i?.categoryName || '').toString().trim()).filter(Boolean);
    return Array.from(new Set<string>([...base, ...inUse])).sort();
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
    if (!this.showForm && this.categories.length === 0) {
      this.toastr.warning('Add at least one category in Settings before adding menu items.', 'No Categories');
      return;
    }
    this.showForm = !this.showForm;
    if (this.showForm) {
      // Opening the form — leave bulk mode (mutually exclusive)
      if (this.bulkMode) { this.bulkMode = false; this.clearBulkSelection(); }
      this.scrollToForm();
    } else {
      this.resetForm();
    }
  }

  /** Bring the (top-of-page) form into view so the admin sees it open. */
  private scrollToForm(): void {
    setTimeout(() => {
      document.getElementById('menu-item-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  // ── Smart Fill (IDE-style, progressive) ─────────────────────────────────
  nameGhost = '';                       // grey completion suffix for the name field
  private nameTimer: any;               // debounce for the AI completion fallback
  private readonly TARGET_MARGIN = 0.65; // matches the backend manifest's price rule

  /** Name-completion vocabulary: the store's OWN item names + categories (never invented). */
  private get nameVocab(): string[] {
    const names = this.menuItems.map(i => i?.name).filter((n: any) => !!n);
    return Array.from(new Set<string>([...names, ...this.formCategories]));
  }

  /**
   * Ghost suffix as the owner types: an INSTANT local match from the store's own vocabulary,
   * falling back to a debounced AI completion (append-only) for brand-new items not on the menu.
   */
  onNameChange(): void {
    this.nameGhost = '';
    clearTimeout(this.nameTimer);
    const name = this.formData.name || '';
    if (name.trim().length < 2) return;

    // 1) instant: complete from an existing item/category
    const local = this.nameVocab.find(v => v.toLowerCase().startsWith(name.toLowerCase()) && v.length > name.length);
    if (local) { this.nameGhost = local.substring(name.length); return; }

    // 2) fallback: AI completes a new name (debounced so it's one call per pause, not per keystroke)
    if (name.trim().length < 3) return;
    this.nameTimer = setTimeout(() => {
      this.adminAiService.completeName(this.formData.name || '', this.formData.category).subscribe({
        next: (res) => {
          const sug = (res?.name || '').trim();
          const cur = this.formData.name || '';
          // still the same prefix, and a genuine extension → show as ghost
          if (sug && cur && sug.toLowerCase().startsWith(cur.toLowerCase()) && sug.length > cur.length) {
            this.nameGhost = sug.substring(cur.length);
          }
        },
        error: () => {}
      });
    }, 450);
  }

  /** Tab accepts the ghost completion (IDE-style). */
  onNameKeydown(e: KeyboardEvent): void {
    if (e.key === 'Tab' && this.nameGhost) {
      e.preventDefault();
      this.formData.name = (this.formData.name || '') + this.nameGhost;
      this.nameGhost = '';
    }
  }

  /** Rule #1: price intelligence is gated on a real cost — no cost, no price suggestion. */
  get canSuggestPrice(): boolean {
    return this.formData.cost != null && this.formData.cost > 0;
  }
  /** Deterministic suggested price from cost at the target margin (the manifest rule). */
  get suggestedPrice(): number | null {
    const c = this.formData.cost;
    return c != null && c > 0 ? Math.round(c / (1 - this.TARGET_MARGIN)) : null;
  }
  get suggestedPriceMargin(): number | null {
    const p = this.suggestedPrice;
    const c = this.formData.cost;
    return p && p > 0 && c != null ? Math.round((p - c) / p * 100) : null;
  }
  useSuggestedPrice(): void {
    const p = this.suggestedPrice;
    if (p) this.formData.price = p;
  }

  /**
   * Rule #2: AI COMPLETES a partial item, never creates one. A description needs both a
   * name (intent) AND a category (classification) — without them there's nothing to complete.
   */
  get canGenerate(): boolean {
    return !!this.formData.name?.trim() && !!this.formData.category;
  }

  /** ✨ Complete the empty fields (description, category, price) from the typed name. Never fills cost. */
  generateWithAi(): void {
    if (!this.canGenerate) {
      this.toastr.warning('Add a name and category first', 'Suggest details');
      return;
    }
    this.aiGenerating = true;
    this.adminAiService.describeItem({
      name: this.formData.name,
      price: this.formData.price,
      category: this.formData.category
    }).subscribe({
      next: (res) => {
        this.aiGenerating = false;
        if (res.recognized === false) {        // AI didn't recognise the name — don't invent a description/price
          this.toastr.warning(res.message || `Couldn't recognise "${this.formData.name}" as a menu item — check the name`, 'AI');
          return;
        }
        if (res.description) this.formData.description = res.description;
        if (res.suggestedCategory && !this.formData.category) {
          this.formData.category = res.suggestedCategory;
        }
        const applyPrice = !!res.suggestedPrice && (!this.formData.price || this.formData.price <= 0);
        if (applyPrice) this.formData.price = res.suggestedPrice!;
        const msg = applyPrice
          ? 'Wrote the description; suggested a price from your similar items — adjust to your costs'
          : 'Wrote the description';
        this.toastr.success(msg, 'AI');
      },
      error: () => {
        this.aiGenerating = false;
        this.toastr.error('AI generation is unavailable right now', 'AI Generate');
      }
    });
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
    if (this.bulkMode) { this.bulkMode = false; this.clearBulkSelection(); }
    this.formData = { ...item };
    this.showForm = true;
    this.isEditing = true;
    this.menuFormSubmitted = false;
    this.scrollToForm();
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
      cost: null,
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
        const updated = res.updated || 0;
        this.importResult = `${res.created} created, ${updated} updated, ${res.skipped} skipped`;
        if (res.created > 0 || updated > 0) {
          this.toastr.success(`${res.created} created, ${updated} updated`);
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
    if (this.bulkMode) {
      // Entering bulk mode — close the add/edit form (mutually exclusive)
      if (this.showForm) { this.showForm = false; this.resetForm(); }
    } else {
      this.clearBulkSelection();
    }
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
    this.confirm.ask({
      title: 'Delete option group?',
      message: 'This option group and all its choices will be removed from the item.',
      confirmLabel: 'Delete',
    }).subscribe(ok => {
      if (!ok) return;
      this.http.delete(
        `${environment.apiUrl}/api/admin/menu-items/${itemId}/options/${groupId}`,
        { headers: this.authHeaders }
      ).subscribe({
        next: () => this.loadOptions(itemId),
        error: () => this.toastr.error('Failed to delete group')
      });
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
    this.confirm.ask({
      title: 'Delete choice?',
      message: 'This choice will be removed from the option group.',
      confirmLabel: 'Delete',
    }).subscribe(ok => {
      if (!ok) return;
      this.http.delete(
        `${environment.apiUrl}/api/admin/menu-items/${itemId}/options/${groupId}/choices/${choiceId}`,
        { headers: this.authHeaders }
      ).subscribe({
        next: () => this.loadOptions(itemId),
        error: () => this.toastr.error('Failed to delete choice')
      });
    });
  }
}
