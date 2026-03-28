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

  // Edit modal
  editingTenant: Tenant | null = null;
  editForm!: FormGroup;
  saving = false;

  // Delete confirm
  deletingTenant: Tenant | null = null;
  deleting = false;

  subscriptionPlans = ['BASIC', 'PRO', 'ENTERPRISE'];
  subscriptionStatuses = ['TRIAL', 'ACTIVE', 'SUSPENDED'];

  constructor(
    private superadminService: SuperadminService,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
    this.loading = true;
    this.error = false;
    this.superadminService.getTenants().subscribe({
      next: (data) => {
        this.tenants = data;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }

  openEdit(tenant: Tenant): void {
    this.editingTenant = tenant;
    this.editForm = this.fb.group({
      name: [tenant.name, [Validators.required]],
      slug: [tenant.slug, [Validators.required]],
      primaryColor: [tenant.primaryColor || ''],
      subscriptionPlan: [tenant.subscriptionPlan, [Validators.required]],
      subscriptionStatus: [tenant.subscriptionStatus, [Validators.required]],
      platformCommissionPercent: [tenant.platformCommissionPercent, [Validators.required, Validators.min(0), Validators.max(100)]],
      deliveryRadiusKm: [tenant.deliveryRadiusKm, [Validators.required, Validators.min(1)]],
      active: [tenant.active]
    });
  }

  closeEdit(): void {
    this.editingTenant = null;
  }

  saveEdit(): void {
    if (this.editForm.invalid || !this.editingTenant) return;
    this.saving = true;

    const updated: Tenant = {
      ...this.editingTenant,
      ...this.editForm.value
    };

    this.superadminService.updateTenant(this.editingTenant.id, updated).subscribe({
      next: (saved) => {
        const idx = this.tenants.findIndex(t => t.id === saved.id);
        if (idx !== -1) this.tenants[idx] = saved;
        this.saving = false;
        this.editingTenant = null;
        this.toastr.success('Store updated successfully');
      },
      error: () => {
        this.saving = false;
        this.toastr.error('Failed to update store');
      }
    });
  }

  toggleActive(tenant: Tenant): void {
    this.superadminService.toggleActive(tenant.id).subscribe({
      next: (updated) => {
        const idx = this.tenants.findIndex(t => t.id === updated.id);
        if (idx !== -1) this.tenants[idx] = updated;
        this.toastr.success(`Store ${updated.active ? 'activated' : 'deactivated'}`);
      },
      error: () => {
        this.toastr.error('Failed to toggle store status');
      }
    });
  }

  confirmDelete(tenant: Tenant): void {
    this.deletingTenant = tenant;
  }

  cancelDelete(): void {
    this.deletingTenant = null;
  }

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
      error: () => {
        this.toastr.error('Failed to delete store');
        this.deleting = false;
      }
    });
  }

  statusClass(status: string): BadgeVariant {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'SUSPENDED': return 'danger';
      default: return 'warning';
    }
  }
}
