import { Component, OnInit, OnDestroy } from '@angular/core';
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
export class GroupCartComponent implements OnInit, OnDestroy {
  cart: GroupCartSummary | null = null;
  loading = true;
  error = '';
  removingId: string | null = null;

  private token = '';
  private pollInterval: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private groupCartService: GroupCartService,
    public authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) { this.router.navigate(['/']); return; }
    this.load();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  load(): void {
    this.loading = true;
    this.groupCartService.get(this.token).subscribe({
      next: cart => {
        this.cart = cart;
        this.loading = false;
        if (cart.status === 'OPEN') this.startPolling();
      },
      error: () => { this.error = 'Group cart not found or has expired.'; this.loading = false; }
    });
  }

  private startPolling(): void {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => {
      this.groupCartService.get(this.token).subscribe({
        next: cart => {
          this.cart = cart;
          if (cart.status !== 'OPEN') this.stopPolling();
        },
        error: () => {}
      });
    }, 4000);
  }

  private stopPolling(): void {
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
  }

  get isOwner(): boolean {
    const uid = this.authService.getUserId();
    return !!uid && uid === this.cart?.ownerId;
  }

  get currentUserId(): string { return this.authService.getUserId() || ''; }

  removeItem(itemId: string): void {
    this.removingId = itemId;
    this.groupCartService.removeItem(this.token, itemId).subscribe({
      next: () => {
        if (this.cart) {
          this.cart.items = this.cart.items.filter(i => i.id !== itemId);
          this.cart.total = Math.round(this.cart.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100) / 100;
        }
        this.removingId = null;
      },
      error: () => { this.toastr.error('Could not remove item'); this.removingId = null; }
    });
  }

  addMyItems(): void {
    if (!this.authService.isLoggedIn()) {
      // Send to login then back here after auth
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const slug = this.cart?.storeSlug || localStorage.getItem('storeSlug');
    if (!slug) { this.toastr.error('Could not determine store'); return; }
    // Store the token so the product page knows to add to this group cart
    localStorage.setItem('groupCartToken', this.token);
    localStorage.setItem('storeSlug', slug);
    this.router.navigate(['/store', slug]);
  }

  goToCheckout(): void {
    // Clear group cart token — the owner is now checking out, cart is done
    localStorage.removeItem('groupCartToken');
    const slug = this.cart?.storeSlug || localStorage.getItem('storeSlug');
    if (slug) this.router.navigate(['/store', slug, 'checkout']);
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareUrl)
      .then(() => this.toastr.success('Link copied!'))
      .catch(() => this.toastr.info('Copy this link: ' + this.shareUrl));
  }

  get shareUrl(): string {
    const slug = this.cart?.storeSlug || localStorage.getItem('storeSlug') || '';
    return `${window.location.origin}/store/${slug}/group-cart/${this.token}`;
  }

  getImageUrl(path?: string): string {
    if (!path) return 'assets/placeholder.png';
    return path.startsWith('http') ? path : `${environment.apiUrl}${path}`;
  }
}
