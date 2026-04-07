import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage = '';
  isLoading = false;
  showPassword = false;
  returnUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
  }

  onLogin(): void {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        // If there's a return URL (e.g. from store browse), go back there
        if (this.returnUrl) {
          this.router.navigateByUrl(this.returnUrl, { replaceUrl: true });
          return;
        }

        const role = this.authService.getUserRole();
        if (role === 'ROLE_SUPERADMIN') {
          this.router.navigate(['/superadmin'], { replaceUrl: true });
        } else if (role === 'ROLE_ADMIN') {
          this.router.navigate(['/admin/dashboard'], { replaceUrl: true });
        } else if (role === 'ROLE_DRIVER') {
          this.router.navigate(['/driver/dashboard'], { replaceUrl: true });
        } else if (role === 'ROLE_MANAGER') {
          this.router.navigate(['/manager/dashboard'], { replaceUrl: true });
        } else {
          this.router.navigate(['/stores'], { replaceUrl: true });
        }
      },
      error: () => {
        this.errorMessage = 'Invalid email or password';
        this.isLoading = false;
      }
    });
  }
}
