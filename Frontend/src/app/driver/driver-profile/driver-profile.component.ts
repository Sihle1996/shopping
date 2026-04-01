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

  constructor(private fb: FormBuilder, private driverService: DriverService) {
    this.form = this.fb.group({
      fullName: [''],
      phone: [''],
      vehicleType: [''],
      vehiclePlate: ['']
    });
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
