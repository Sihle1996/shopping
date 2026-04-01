import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface UserSummary {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  tenantId: string | null;
}

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html'
})
export class AdminUsersComponent implements OnInit {
  users: UserSummary[] = [];
  filtered: UserSummary[] = [];
  loading = true;
  search = '';
  roleFilter = '';
  toast = '';
  toastType: 'success' | 'error' = 'success';
  confirmDeleteId: string | null = null;

  private api = environment.apiUrl + '/api/admin/users';

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.http.get<UserSummary[]>(this.api).subscribe({
      next: users => { this.users = users; this.applyFilter(); this.loading = false; },
      error: () => { this.showToast('Failed to load users', 'error'); this.loading = false; }
    });
  }

  applyFilter() {
    const q = this.search.toLowerCase();
    this.filtered = this.users.filter(u =>
      (!q || u.email.toLowerCase().includes(q) || (u.fullName ?? '').toLowerCase().includes(q)) &&
      (!this.roleFilter || u.role === this.roleFilter)
    );
  }

  setRole(user: UserSummary, role: string) {
    this.http.patch<UserSummary>(`${this.api}/${user.id}/role`, { role }).subscribe({
      next: updated => {
        Object.assign(user, updated);
        this.showToast(`Role updated to ${role}`);
      },
      error: err => this.showToast(err.error?.message || 'Failed to update role', 'error')
    });
  }

  toggleActive(user: UserSummary) {
    this.http.patch<UserSummary>(`${this.api}/${user.id}/active`, { active: !user.active }).subscribe({
      next: updated => {
        Object.assign(user, updated);
        this.showToast(updated.active ? 'User activated' : 'User deactivated');
      },
      error: () => this.showToast('Failed to update status', 'error')
    });
  }

  confirmDelete(id: string) { this.confirmDeleteId = id; }

  cancelDelete() { this.confirmDeleteId = null; }

  deleteUser() {
    if (!this.confirmDeleteId) return;
    const id = this.confirmDeleteId;
    this.http.delete(`${this.api}/${id}`).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== id);
        this.applyFilter();
        this.confirmDeleteId = null;
        this.showToast('User deleted');
      },
      error: () => { this.confirmDeleteId = null; this.showToast('Failed to delete user', 'error'); }
    });
  }

  roleBadgeClass(role: string): string {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-700';
      case 'DRIVER': return 'bg-blue-100 text-blue-700';
      case 'SUPERADMIN': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  private showToast(msg: string, type: 'success' | 'error' = 'success') {
    this.toast = msg; this.toastType = type;
    setTimeout(() => this.toast = '', 3000);
  }
}
