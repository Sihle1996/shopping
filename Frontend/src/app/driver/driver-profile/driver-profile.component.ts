import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { DriverService } from 'src/app/services/driver.service';

@Component({
  selector: 'app-driver-profile',
  templateUrl: './driver-profile.component.html'
})
export class DriverProfileComponent implements OnInit {
  form: FormGroup;
  earnings: { deliveredCount: number; totalEarnings: number } | null = null;
  loading = true;
  saving = false;
  toast = '';
  toastType: 'success' | 'error' = 'success';

  private readonly AVATAR_COLORS = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-rose-500', 'bg-indigo-500'
  ];

  constructor(private fb: FormBuilder, private driverService: DriverService) {
    this.form = this.fb.group({
      fullName: [''],
      phone: [''],
      vehicleType: [''],
      vehiclePlate: ['']
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

  private showToast(msg: string, type: 'success' | 'error' = 'success') {
    this.toast = msg; this.toastType = type;
    setTimeout(() => this.toast = '', 3000);
  }
}
