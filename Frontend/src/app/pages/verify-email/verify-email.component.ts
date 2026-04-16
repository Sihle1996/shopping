import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html'
})
export class VerifyEmailComponent implements OnInit {
  status: 'loading' | 'success' | 'error' = 'loading';
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.status = 'error';
      this.errorMessage = 'Verification link is missing or invalid.';
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: (response: any) => {
        if (response?.token) {
          this.authService.storeToken(response.token);
        }
        this.status = 'success';
        const role = this.authService.getUserRole();
        setTimeout(() => {
          if (role === 'ROLE_ADMIN') {
            this.router.navigate(['/admin/dashboard'], { replaceUrl: true });
          } else if (role === 'ROLE_DRIVER') {
            this.router.navigate(['/driver/dashboard'], { replaceUrl: true });
          } else {
            this.router.navigate(['/stores'], { replaceUrl: true });
          }
        }, 2000);
      },
      error: (err) => {
        this.status = 'error';
        this.errorMessage = err.error || 'Verification failed. The link may have expired.';
      }
    });
  }
}
