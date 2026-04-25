import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { GroupCartService, GroupCartSummary } from 'src/app/services/group-cart.service';
import { CartService, CartItem } from 'src/app/services/cart.service';
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
  personalCartItems: CartItem[] = [];
  mergingPersonalCart = false;

  private token = '';
  private pollInterval: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private groupCartService: GroupCartService,
    private cartService: CartService,
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
        if (cart.status === 'OPEN') {
          if (this.authService.isLoggedIn()) {
            localStorage.setItem('groupCartToken', this.token);
            this.checkPersonalCart();
          }
          if (cart.storeSlug) localStorage.setItem('storeSlug', cart.storeSlug);
          this.startPolling();
        }
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

  private checkPersonalCart(): void {
    this.cartService.getCartItems().subscribe({
      next: items => { this.personalCartItems = items; },
      error: () => {}
    });
  }

  mergePersonalCart(): void {
    if (!this.personalCartItems.length) return;
    this.mergingPersonalCart = true;
    forkJoin(
      this.personalCartItems.map(item =>
        this.groupCartService.addItem(this.token, item.menuItemId, item.quantity,
          item.selectedChoicesJson ?? null, item.itemNotes ?? null)
      )
    ).subscribe({
      next: () => {
        this.cartService.clearCart();
        this.personalCartItems = [];
        this.mergingPersonalCart = false;
        this.toastr.success('Your items have been added to the group order!');
        this.load();
      },
      error: () => {
        this.mergingPersonalCart = false;
        this.toastr.error('Could not add all items — please try again');
      }
    });
  }

  dismissPersonalCart(): void {
    this.personalCartItems = [];
  }

  get isOwner(): boolean {
    const uid = this.authService.getUserId();
    return !!uid && uid === this.cart?.ownerId;
  }

  get isLoggedIn(): boolean { return this.authService.isLoggedIn(); }
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
    // Keep groupCartToken — checkout reads it to load the group cart items
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
