import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  errorMessage = '';
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;
  tenantId: string | null = null;
  storeName: string | null = null;
  returnUrl: string | null = null;
  emailSent = false;
  registeredEmail = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.queryParamMap.get('tenantId');
    this.storeName = this.route.snapshot.queryParamMap.get('store');
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validator: this.passwordsMatchValidator });
  }

  passwordsMatchValidator(form: FormGroup) {
    return form.get('password')?.value === form.get('confirmPassword')?.value
      ? null
      : { mismatch: true };
  }

  get isRestaurantSetup(): boolean {
    return !!this.tenantId;
  }

  register(): void {
    this.registerForm.markAllAsTouched();
    if (this.registerForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.registeredEmail = this.registerForm.value.email;

    this.authService.register(this.registerForm.value, this.tenantId || undefined).subscribe({
      next: () => {
        this.emailSent = true;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || err.error || 'Registration failed. Please try again.';
        this.isLoading = false;
      }
    });
  }
}
