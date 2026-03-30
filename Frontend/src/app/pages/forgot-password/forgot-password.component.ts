import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  step: 'email' | 'otp' = 'email';
  isLoading = false;
  email = '';

  emailForm: FormGroup;
  resetForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
    this.resetForm = this.fb.group({
      otp: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordsMatch });
  }

  private passwordsMatch(form: FormGroup) {
    return form.get('newPassword')?.value === form.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  sendOtp(): void {
    if (this.emailForm.invalid) return;
    this.isLoading = true;
    this.email = this.emailForm.value.email;
    this.http.post(`${environment.apiUrl}/api/forgot-password`, { email: this.email }, { responseType: 'text' }).subscribe({
      next: () => {
        this.step = 'otp';
        this.isLoading = false;
        this.toastr.success('Reset code sent to your email');
      },
      error: (err) => {
        this.toastr.error(err.error || 'Could not send reset code');
        this.isLoading = false;
      }
    });
  }

  resetPassword(): void {
    if (this.resetForm.invalid) return;
    this.isLoading = true;
    const { otp, newPassword } = this.resetForm.value;
    this.http.post(`${environment.apiUrl}/api/reset-password`, { email: this.email, otp, newPassword }, { responseType: 'text' }).subscribe({
      next: () => {
        this.toastr.success('Password reset successfully');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.toastr.error(err.error || 'Invalid or expired code');
        this.isLoading = false;
      }
    });
  }
}
