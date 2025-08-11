import { Component } from '@angular/core';
import { AdminService } from 'src/app/services/admin.service';

@Component({
  selector: 'app-admin-drivers',
  templateUrl: './admin-drivers.component.html',
  styleUrls: ['./admin-drivers.component.scss']
})
  export class AdminDriversComponent {
    newDriver = { email: '', password: '' };

    constructor(private adminService: AdminService) {}

    addDriver(): void {
      if (!this.newDriver.email || !this.newDriver.password) {
        return;
      }

      this.adminService.createDriver(this.newDriver).subscribe({
        next: () => {
          this.newDriver = { email: '', password: '' };
        },
        error: (err: unknown) => console.error('Failed to create driver', err)
      });
    }
  }

