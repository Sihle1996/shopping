import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AddressService, UserAddress } from 'src/app/services/address.service';

@Component({
  selector: 'app-address-book',
  templateUrl: './address-book.component.html'
})
export class AddressBookComponent implements OnInit {
  addresses: UserAddress[] = [];
  loading = true;
  showForm = false;
  editingId: string | null = null;
  form: FormGroup;
  saving = false;
  confirmDeleteId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private addressService: AddressService,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group({
      label: ['Home', Validators.required],
      street: ['', Validators.required],
      city: ['', Validators.required],
      postalCode: [''],
      isDefault: [false]
    });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.addressService.list().subscribe({
      next: a => { this.addresses = a; this.loading = false; },
      error: () => { this.loading = false; this.toastr.error('Failed to load addresses'); }
    });
  }

  openAdd() {
    this.editingId = null;
    this.form.reset({ label: 'Home', street: '', city: '', postalCode: '', isDefault: false });
    this.showForm = true;
  }

  openEdit(a: UserAddress) {
    this.editingId = a.id;
    this.form.patchValue({ label: a.label, street: a.street, city: a.city, postalCode: a.postalCode, isDefault: a.isDefault });
    this.showForm = true;
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving = true;
    const req = this.form.value;
    const op = this.editingId
      ? this.addressService.update(this.editingId, req)
      : this.addressService.create(req);
    op.subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.load();
        this.toastr.success(this.editingId ? 'Address updated' : 'Address saved');
      },
      error: () => { this.saving = false; this.toastr.error('Failed to save address'); }
    });
  }

  confirmDelete(id: string) { this.confirmDeleteId = id; }
  cancelDelete() { this.confirmDeleteId = null; }

  deleteAddress() {
    if (!this.confirmDeleteId) return;
    const id = this.confirmDeleteId;
    this.addressService.delete(id).subscribe({
      next: () => {
        this.addresses = this.addresses.filter(a => a.id !== id);
        this.confirmDeleteId = null;
        this.toastr.success('Address deleted');
      },
      error: () => { this.confirmDeleteId = null; this.toastr.error('Failed to delete'); }
    });
  }

  goBack() {
    this.router.navigate(['/profile']);
  }
}
