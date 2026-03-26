import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TenantService } from 'src/app/services/tenant.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-register-restaurant',
  templateUrl: './register-restaurant.component.html',
  styleUrls: ['./register-restaurant.component.scss']
})
export class RegisterRestaurantComponent {
  form: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private tenantService: TenantService,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: ['']
    });

    // Auto-generate slug from name
    this.form.get('name')?.valueChanges.subscribe(name => {
      if (name && !this.form.get('slug')?.dirty) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        this.form.get('slug')?.setValue(slug, { emitEvent: false });
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.tenantService.registerTenant(this.form.value).subscribe({
      next: (tenant) => {
        this.toastr.success(`${tenant.name} registered successfully!`);
        localStorage.setItem('storeName', tenant.name);
        this.router.navigate(['/register'], {
          queryParams: { tenantId: tenant.id, store: tenant.name }
        });
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Registration failed. Please try again.';
        this.isLoading = false;
      }
    });
  }
}
