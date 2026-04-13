import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { driver } from 'driver.js';
import { AdminService } from 'src/app/services/admin.service';

@Component({
  selector: 'app-admin-drivers',
  templateUrl: './admin-drivers.component.html',
  styleUrls: ['./admin-drivers.component.scss']
})
export class AdminDriversComponent implements OnInit {
  newDriver = { email: '', password: '' };
  drivers: any[] = [];
  loading = false;
  submitting = false;
  deletingId: string | null = null;
  toast: string | null = null;
  toastType: 'success' | 'error' = 'success';

  constructor(private adminService: AdminService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.loadDrivers();
    const tour = this.route.snapshot.queryParamMap.get('tour');
    if (tour === 'add-driver') {
      setTimeout(() => {
        const d = driver({ animate: true, overlayOpacity: 0.35 });
        d.highlight({
          element: '#add-driver-form',
          popover: { title: 'Add a Driver', description: 'Enter your driver\'s email and a password to create their account', side: 'bottom', align: 'start' }
        });
      }, 500);
    }
  }

  loadDrivers(): void {
    this.loading = true;
    this.adminService.getDrivers().subscribe({
      next: (drivers: any[]) => {
        this.drivers = drivers;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  addDriver(): void {
    if (!this.newDriver.email || !this.newDriver.password) return;
    this.submitting = true;
    this.adminService.createDriver(this.newDriver).subscribe({
      next: () => {
        this.newDriver = { email: '', password: '' };
        this.submitting = false;
        this.showToast('Driver added successfully', 'success');
        this.loadDrivers();
      },
      error: (err: any) => {
        this.submitting = false;
        this.showToast(err?.error?.message || 'Failed to add driver', 'error');
      }
    });
  }

  deleteDriver(id: string): void {
    this.deletingId = id;
    this.adminService.deleteDriver(id).subscribe({
      next: () => {
        this.drivers = this.drivers.filter((d: any) => d.id !== id);
        this.deletingId = null;
        this.showToast('Driver removed', 'success');
      },
      error: () => {
        this.deletingId = null;
        this.showToast('Failed to remove driver', 'error');
      }
    });
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toast = msg;
    this.toastType = type;
    setTimeout(() => (this.toast = null), 3000);
  }
}
