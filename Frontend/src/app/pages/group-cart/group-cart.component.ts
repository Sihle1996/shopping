import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { GroupCartService, GroupCartSummary } from 'src/app/services/group-cart.service';
import { AuthService } from 'src/app/services/auth.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-group-cart',
  templateUrl: './group-cart.component.html',
  styleUrls: ['./group-cart.component.scss']
})
export class GroupCartComponent implements OnInit {
  cart: GroupCartSummary | null = null;
  loading = true;
  error = '';
  removingId: string | null = null;
  closing = false;

  private token = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private groupCartService: GroupCartService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) { this.router.navigate(['/']); return; }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.groupCartService.get(this.token).subscribe({
      next: cart => { this.cart = cart; this.loading = false; },
      error: () => { this.error = 'Group cart not found or has expired.'; this.loading = false; }
    });
  }

  get isOwner(): boolean {
    if (!this.cart) return false;
    const userId = this.authService.getUserId();
    return !!userId && this.cart.items.some(i => i.addedBy?.id === userId &&
      this.cart?.ownerName === (i.addedBy?.fullName || i.addedBy?.email));
  }

  get currentUserId(): string { return this.authService.getUserId() || ''; }

  removeItem(itemId: string): void {
    this.removingId = itemId;
    this.groupCartService.removeItem(this.token, itemId).subscribe({
      next: () => {
        if (this.cart) this.cart.items = this.cart.items.filter(i => i.id !== itemId);
        this.cart!.total = this.cart!.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        this.removingId = null;
      },
      error: () => { this.toastr.error('Could not remove item'); this.removingId = null; }
    });
  }

  addMyItems(): void {
    const slug = this.cart?.storeSlug || localStorage.getItem('storeSlug');
    if (slug) {
      localStorage.setItem('groupCartToken', this.token);
      this.router.navigate(['/store', slug]);
    }
  }

  goToCheckout(): void {
    const slug = this.cart?.storeSlug || localStorage.getItem('storeSlug');
    if (slug) this.router.navigate(['/store', slug, 'checkout']);
  }

  getImageUrl(path?: string): string {
    if (!path) return 'assets/placeholder.png';
    return path.startsWith('http') ? path : `${environment.apiUrl}${path}`;
  }

  copyLink(): void {
    const url = `${window.location.origin}/store/${this.cart?.storeSlug}/group-cart/${this.token}`;
    navigator.clipboard.writeText(url).then(() => this.toastr.success('Link copied!'));
  }

  get shareUrl(): string {
    return `${window.location.origin}/store/${this.cart?.storeSlug}/group-cart/${this.token}`;
  }
}
