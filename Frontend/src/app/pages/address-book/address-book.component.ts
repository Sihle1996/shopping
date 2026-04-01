import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
  toast = '';
  toastType: 'success' | 'error' = 'success';
  confirmDeleteId: string | null = null;

  constructor(private fb: FormBuilder, private addressService: AddressService) {
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
      error: () => { this.loading = false; this.showToast('Failed to load addresses', 'error'); }
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
        this.showToast(this.editingId ? 'Address updated' : 'Address saved');
      },
      error: () => { this.saving = false; this.showToast('Failed to save', 'error'); }
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
        this.showToast('Address deleted');
      },
      error: () => { this.confirmDeleteId = null; this.showToast('Failed to delete', 'error'); }
    });
  }

  private showToast(msg: string, type: 'success' | 'error' = 'success') {
    this.toast = msg; this.toastType = type;
    setTimeout(() => this.toast = '', 3000);
  }
}
