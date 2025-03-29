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
  errorMessage: string = '';

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

  onLogin() {
    if (this.loginForm.invalid) return;
  
    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        // 🔍 Double-check decoded role
        const role = this.authService.getUserRole();
        console.log('✅ User role:', role);
  
        if (role === 'ROLE_ADMIN') {
          this.router.navigate(['/admin/dashboard'], { replaceUrl: true });
        } else if (role === 'ROLE_DRIVER') {
          this.router.navigate(['/driver/dashboard'], { replaceUrl: true });
        } else {
          this.router.navigate(['/'], { replaceUrl: true });
        }        
      },
      error: (err) => {
        console.error("Login error:", err);
        this.errorMessage = 'Invalid email or password';
      }
    });
  }
  
  

  private getRoleFromToken(token: string): string | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || null;
    } catch (e) {
      return null;
    }
  }
}
