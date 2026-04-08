import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Tenant, SuperadminService } from '../superadmin.service';
import { BadgeVariant } from 'src/app/shared/components/badge/badge.component';

@Component({
  selector: 'app-superadmin-stores',
  templateUrl: './superadmin-stores.component.html',
  styleUrls: ['./superadmin-stores.component.scss']
})
export class SuperadminStoresComponent implements OnInit {
  tenants: Tenant[] = [];
  loading = true;
  error = false;

  // Search & filter
  searchTerm = '';
  filterPlan = '';
  filterStatus = '';
  filterActive = '';

  // Edit modal
  editingTenant: Tenant | null = null;
  editForm!: FormGroup;
  saving = false;

  // Create modal
  showCreateModal = false;
  createForm!: FormGroup;
  creating = false;

  // Delete confirm
  deletingTenant: Tenant | null = null;
  deleting = false;

  readonly subscriptionPlans = ['BASIC', 'PRO', 'ENTERPRISE'];
  readonly subscriptionStatuses = ['TRIAL', 'ACTIVE', 'SUSPENDED'];

  constructor(
    private superadminService: SuperadminService,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadTenants();
    this.createForm = this.fb.group({
      name: ['', Validators.required],
      slug: [''],
      email: ['', Validators.email],
      phone: [''],
      subscriptionPlan: ['BASIC', Validators.required],
      subscriptionStatus: ['TRIAL', Validators.required],
      platformCommissionPercent: [10, [Validators.required, Validators.min(0), Validators.max(100)]],
      deliveryRadiusKm: [10, [Validators.required, Validators.min(1)]],
      primaryColor: ['#4f46e5']
    });
  }

  loadTenants(): void {
    this.loading = true;
    this.error = false;
    this.superadminService.getTenants().subscribe({
      next: (data) => { this.tenants = data; this.loading = false; },
      error: () => { this.error = true; this.loading = false; }
    });
  }

  get filteredTenants(): Tenant[] {
    const term = this.searchTerm.toLowerCase();
    return this.tenants.filter(t => {
      const matchesSearch = !term ||
        t.name.toLowerCase().includes(term) ||
        t.slug.toLowerCase().includes(term) ||
        (t.email || '').toLowerCase().includes(term);
      const matchesPlan = !this.filterPlan || t.subscriptionPlan === this.filterPlan;
      const matchesStatus = !this.filterStatus || t.subscriptionStatus === this.filterStatus;
      const matchesActive = this.filterActive === '' ||
        (this.filterActive === 'true' ? t.active : !t.active);
      return matchesSearch && matchesPlan && matchesStatus && matchesActive;
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterPlan = '';
    this.filterStatus = '';
    this.filterActive = '';
  }

  get hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.filterPlan || this.filterStatus || this.filterActive !== '');
  }

  // ── Create ────────────────────────────────────────────────────────────────

  openCreate(): void {
    this.createForm.reset({
      subscriptionPlan: 'BASIC', subscriptionStatus: 'TRIAL',
      platformCommissionPercent: 10, deliveryRadiusKm: 10, primaryColor: '#4f46e5'
    });
    this.showCreateModal = true;
  }

  closeCreate(): void { this.showCreateModal = false; }

  submitCreate(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.superadminService.createTenant(this.createForm.value).subscribe({
      next: (created) => {
        this.tenants.unshift(created);
        this.creating = false;
        this.showCreateModal = false;
        this.toastr.success(`Store "${created.name}" created`);
      },
      error: () => { this.creating = false; this.toastr.error('Failed to create store'); }
    });
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  openEdit(tenant: Tenant): void {
    this.editingTenant = tenant;
    this.editForm = this.fb.group({
      name: [tenant.name, Validators.required],
      slug: [tenant.slug, Validators.required],
      email: [tenant.email || '', Validators.email],
      phone: [tenant.phone || ''],
      primaryColor: [tenant.primaryColor || ''],
      subscriptionPlan: [tenant.subscriptionPlan, Validators.required],
      subscriptionStatus: [tenant.subscriptionStatus, Validators.required],
      platformCommissionPercent: [tenant.platformCommissionPercent, [Validators.required, Validators.min(0), Validators.max(100)]],
      deliveryRadiusKm: [tenant.deliveryRadiusKm, [Validators.required, Validators.min(1)]],
      active: [tenant.active]
    });
  }

  closeEdit(): void { this.editingTenant = null; }

  saveEdit(): void {
    if (this.editForm.invalid || !this.editingTenant) return;
    this.saving = true;
    const updated: Tenant = { ...this.editingTenant, ...this.editForm.value };
    this.superadminService.updateTenant(this.editingTenant.id, updated).subscribe({
      next: (saved) => {
        const idx = this.tenants.findIndex(t => t.id === saved.id);
        if (idx !== -1) this.tenants[idx] = saved;
        this.saving = false;
        this.editingTenant = null;
        this.toastr.success('Store updated');
      },
      error: () => { this.saving = false; this.toastr.error('Failed to update store'); }
    });
  }

  // ── Toggle / Delete ───────────────────────────────────────────────────────

  toggleActive(tenant: Tenant): void {
    this.superadminService.toggleActive(tenant.id).subscribe({
      next: (updated) => {
        const idx = this.tenants.findIndex(t => t.id === updated.id);
        if (idx !== -1) this.tenants[idx] = updated;
        this.toastr.success(`Store ${updated.active ? 'activated' : 'deactivated'}`);
      },
      error: () => this.toastr.error('Failed to toggle store status')
    });
  }

  confirmDelete(tenant: Tenant): void { this.deletingTenant = tenant; }
  cancelDelete(): void { this.deletingTenant = null; }

  executeDelete(): void {
    if (!this.deletingTenant) return;
    this.deleting = true;
    this.superadminService.deleteTenant(this.deletingTenant.id).subscribe({
      next: () => {
        this.tenants = this.tenants.filter(t => t.id !== this.deletingTenant!.id);
        this.toastr.success('Store deleted');
        this.deletingTenant = null;
        this.deleting = false;
      },
      error: () => { this.toastr.error('Failed to delete store'); this.deleting = false; }
    });
  }

  statusClass(status: string): BadgeVariant {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'SUSPENDED': return 'danger';
      default: return 'warning';
    }
  }

  trackById(_: number, t: Tenant): string { return t.id; }
}
