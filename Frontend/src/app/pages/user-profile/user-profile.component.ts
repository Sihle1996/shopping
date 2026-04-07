import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { ToastrService } from 'ngx-toastr';

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
  email = '';
  role = '';

  constructor(private fb: FormBuilder, private http: HttpClient, private toastr: ToastrService) {
    this.form = this.fb.group({ fullName: [''], phone: [''] });
    this.passwordForm = this.fb.group({ currentPassword: [''], newPassword: [''], confirmPassword: [''] });
  }

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/api/me`).subscribe({
      next: p => {
        this.email = p.email;
        this.role = p.role;
        this.form.patchValue({ fullName: p.fullName, phone: p.phone });
        this.loading = false;
      },
      error: () => { this.loading = false; this.toastr.error('Failed to load profile'); }
    });
  }

  save() {
    this.saving = true;
    this.http.put<any>(`${environment.apiUrl}/api/me`, this.form.value).subscribe({
      next: () => { this.saving = false; this.toastr.success('Profile saved'); },
      error: () => { this.saving = false; this.toastr.error('Failed to save'); }
    });
  }

  changePassword() {
    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;
    if (!currentPassword || !newPassword) { this.toastr.warning('Please fill in all password fields'); return; }
    if (newPassword !== confirmPassword) { this.toastr.warning('New passwords do not match'); return; }
    if (newPassword.length < 6) { this.toastr.warning('New password must be at least 6 characters'); return; }
    this.changingPassword = true;
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
}
