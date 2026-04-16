import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DriverService } from 'src/app/services/driver.service';
import { AuthService } from 'src/app/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-driver-profile',
  templateUrl: './driver-profile.component.html'
})
export class DriverProfileComponent implements OnInit {
  form: FormGroup;
  passwordForm: FormGroup;
  earnings: { deliveredCount: number; totalEarnings: number } | null = null;
  loading = true;
  saving = false;
  savingPassword = false;
  showCurrentPassword = false;
  showNewPassword = false;
  toast = '';
  toastType: 'success' | 'error' = 'success';

  private readonly AVATAR_COLORS = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-rose-500', 'bg-indigo-500'
  ];

  constructor(
    private fb: FormBuilder,
    private driverService: DriverService,
    private http: HttpClient
  ) {
    this.form = this.fb.group({
      fullName: [''],
      phone: [''],
      vehicleType: [''],
      vehiclePlate: ['']
    });
    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  get initials(): string {
    const name = (this.form.get('fullName')?.value || '').trim();
    if (!name) return 'DR';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  get avatarColor(): string {
    const name = (this.form.get('fullName')?.value || 'driver').trim();
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return this.AVATAR_COLORS[Math.abs(hash) % this.AVATAR_COLORS.length];
  }

  ngOnInit() {
    this.driverService.getProfile().subscribe({
      next: p => {
        this.form.patchValue(p);
        this.loading = false;
      },
      error: () => { this.loading = false; this.showToast('Failed to load profile', 'error'); }
    });
    this.driverService.getEarnings().subscribe({
      next: e => this.earnings = e
    });
  }

  save() {
    this.saving = true;
    this.driverService.updateProfile(this.form.value).subscribe({
      next: () => { this.saving = false; this.showToast('Profile saved'); },
      error: () => { this.saving = false; this.showToast('Failed to save', 'error'); }
    });
  }

  changePassword() {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;
    this.savingPassword = true;
    this.http.put(`${environment.apiUrl}/api/change-password`, this.passwordForm.value).subscribe({
      next: () => {
        this.savingPassword = false;
        this.passwordForm.reset();
        this.showToast('Password changed successfully');
      },
      error: (err) => {
        this.savingPassword = false;
        this.showToast(err.error || 'Failed to change password', 'error');
      }
    });
  }

  private showToast(msg: string, type: 'success' | 'error' = 'success') {
    this.toast = msg; this.toastType = type;
    setTimeout(() => this.toast = '', 3000);
  }
}
