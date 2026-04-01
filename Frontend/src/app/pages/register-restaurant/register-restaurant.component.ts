import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { TenantService } from 'src/app/services/tenant.service';
import { GeocodingService } from 'src/app/services/geocoding.service';
import { ToastrService } from 'ngx-toastr';

interface AddressSuggestion {
  label: string;
  lat: number;
  lon: number;
}

@Component({
  selector: 'app-register-restaurant',
  templateUrl: './register-restaurant.component.html',
  styleUrls: ['./register-restaurant.component.scss']
})
export class RegisterRestaurantComponent implements OnInit, OnDestroy {
  form: FormGroup;
  isLoading = false;
  errorMessage = '';

  addressSuggestions: AddressSuggestion[] = [];
  geocodedLat: number | null = null;
  geocodedLon: number | null = null;

  private addressSearch$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private tenantService: TenantService,
    private geocoding: GeocodingService,
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

  ngOnInit(): void {
    // Autocomplete address as store owner types
    this.addressSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length >= 3 ? this.geocoding.autocomplete(q) : Promise.resolve([])),
      takeUntil(this.destroy$)
    ).subscribe(results => this.addressSuggestions = results);

    // Reset geocoded coords when user manually edits the address field
    this.form.get('address')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.geocodedLat = null;
        this.geocodedLon = null;
        const val = this.form.get('address')?.value || '';
        this.addressSearch$.next(val);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectAddressSuggestion(s: AddressSuggestion): void {
    this.form.get('address')?.setValue(s.label, { emitEvent: false });
    this.geocodedLat = s.lat;
    this.geocodedLon = s.lon;
    this.addressSuggestions = [];
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const payload = {
      ...this.form.value,
      ...(this.geocodedLat !== null && { latitude: this.geocodedLat }),
      ...(this.geocodedLon !== null && { longitude: this.geocodedLon })
    };

    this.tenantService.registerTenant(payload).subscribe({
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
