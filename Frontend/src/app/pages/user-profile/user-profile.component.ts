import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/services/auth.service';

type Section = 'personal' | 'security' | 'privacy';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html'
})
export class UserProfileComponent implements OnInit {
  form: FormGroup;
  passwordForm: FormGroup;
  loading = true;
  saving = false;
  changingPassword = false;
  deletingAccount = false;
  showDeleteConfirm = false;
  email = '';
  role = '';
  joinedAt = '';
  activeSection: Section = 'personal';

  private readonly AVATAR_COLORS = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-rose-500', 'bg-indigo-500'
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private toastr: ToastrService,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      fullName: [''],
      phone: ['']
    });
    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordsMatchValidator });
  }

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/api/me`).subscribe({
      next: p => {
        this.email = p.email;
        this.role = p.role;
        this.joinedAt = p.createdAt || '';
        this.form.patchValue({ fullName: p.fullName, phone: p.phone });
        this.loading = false;
      },
      error: () => { this.loading = false; this.toastr.error('Failed to load profile'); }
    });
  }

  get initials(): string {
    const name = (this.form.get('fullName')?.value || '').trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    return this.email ? this.email.substring(0, 2).toUpperCase() : '??';
  }

  get avatarColor(): string {
    const str = this.email || 'user';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return this.AVATAR_COLORS[Math.abs(hash) % this.AVATAR_COLORS.length];
  }

  get displayRole(): string {
    return (this.role || '').replace('ROLE_', '').toLowerCase();
  }

  setSection(s: string) {
    this.activeSection = s as Section;
  }

  save() {
    this.saving = true;
    this.http.put<any>(`${environment.apiUrl}/api/me`, this.form.value).subscribe({
      next: () => { this.saving = false; this.toastr.success('Profile saved'); },
      error: () => { this.saving = false; this.toastr.error('Failed to save'); }
    });
  }

  private passwordsMatchValidator(group: AbstractControl) {
    return (group as FormGroup).get('newPassword')?.value === (group as FormGroup).get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  changePassword() {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;
    this.changingPassword = true;
    const { currentPassword, newPassword } = this.passwordForm.value;
    this.http.put<any>(`${environment.apiUrl}/api/change-password`, { currentPassword, newPassword }).subscribe({
      next: () => {
        this.changingPassword = false;
        this.passwordForm.reset();
        this.toastr.success('Password changed successfully');
      },
      error: (err) => {
        this.changingPassword = false;
        this.toastr.error(err?.error || 'Failed to change password');
      }
    });
  }

  confirmDeleteAccount() {
    this.showDeleteConfirm = true;
  }

  deleteAccount() {
    this.deletingAccount = true;
    this.http.delete(`${environment.apiUrl}/api/me`).subscribe({
      next: () => {
        this.authService.logout();
        this.router.navigate(['/']);
        this.toastr.success('Account deleted');
      },
      error: () => {
        this.deletingAccount = false;
        this.showDeleteConfirm = false;
        this.toastr.error('Failed to delete account');
      }
    });
  }
}
