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
  loading = true;
  saving = false;
  email = '';
  role = '';

  constructor(private fb: FormBuilder, private http: HttpClient, private toastr: ToastrService) {
    this.form = this.fb.group({ fullName: [''], phone: [''] });
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
}
