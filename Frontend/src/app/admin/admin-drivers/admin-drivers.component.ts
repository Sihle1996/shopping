import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/services/admin.service';

@Component({
  selector: 'app-admin-drivers',
  templateUrl: './admin-drivers.component.html',
  styleUrls: ['./admin-drivers.component.scss']
})
export class AdminDriversComponent implements OnInit {
  drivers: any[] = [];
  newDriver = { email: '', password: '' };

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadDrivers();
  }

  loadDrivers(): void {
    this.adminService.getDrivers().subscribe({
      next: data => (this.drivers = data),
      error: err => console.error('Failed to load drivers', err)
    });
  }

  addDriver(): void {
    if (!this.newDriver.email || !this.newDriver.password) {
      return;
    }

    this.adminService.createDriver(this.newDriver).subscribe({
      next: () => {
        this.newDriver = { email: '', password: '' };
        this.loadDrivers();
      },
      error: err => console.error('Failed to create driver', err)
    });
  }

  deleteDriver(id: number): void {
    if (!confirm('Are you sure you want to delete this driver?')) {
      return;
    }

    this.adminService.deleteDriver(id).subscribe({
      next: () => this.loadDrivers(),
      error: err => console.error('Failed to delete driver', err)
    });
  }
}

