import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = '';
  isLoading = false;
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onLogin(): void {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        const role = this.authService.getUserRole();

        if (role === 'ROLE_ADMIN') {
          this.router.navigate(['/admin/dashboard'], { replaceUrl: true });
        } else if (role === 'ROLE_DRIVER') {
          this.router.navigate(['/driver/dashboard'], { replaceUrl: true });
        } else if (role === 'ROLE_MANAGER') {
          this.router.navigate(['/manager/dashboard'], { replaceUrl: true });
        } else {
          this.router.navigate(['/'], { replaceUrl: true });
        }
      },
      error: () => {
        this.errorMessage = 'Invalid email or password';
        this.isLoading = false;
      }
    });
  }
}
