import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { GroupCartService, GroupCartSummary } from 'src/app/services/group-cart.service';
import { CartService, CartItem } from 'src/app/services/cart.service';
import { AuthService } from 'src/app/services/auth.service';
import { environment } from 'src/environments/environment';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

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
  private stompClient: Client | null = null;
  private stompSub: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private groupCartService: GroupCartService,
    private cartService: CartService,
    public authService: AuthService,
    private toastr: ToastrService,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) { this.router.navigate(['/']); return; }
    this.load();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.disconnectWs();
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
            this.connectWs();
          } else {
            this.startPolling();
          }
          if (cart.storeSlug) localStorage.setItem('storeSlug', cart.storeSlug);
        }
      },
      error: () => { this.error = 'Group cart not found or has expired.'; this.loading = false; }
    });
  }

  private connectWs(): void {
    if (this.stompClient?.active) return;
    const authToken = this.authService.getToken();
    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(`${environment.apiUrl}/ws`),
      connectHeaders: { Authorization: `Bearer ${authToken}` },
      reconnectDelay: 0,
      onConnect: () => {
        this.stopPolling();
        this.stompSub = this.stompClient!.subscribe(
          `/topic/group-cart/${this.token}`,
          (msg) => {
            this.zone.run(() => {
              const updated: GroupCartSummary = JSON.parse(msg.body);
              this.cart = updated;
              if (updated.status !== 'OPEN') this.disconnectWs();
            });
          }
        );
      },
      onStompError: () => this.startPolling(),
      onWebSocketError: () => this.startPolling()
    });
    this.stompClient.activate();
  }

  private disconnectWs(): void {
    try { this.stompSub?.unsubscribe(); } catch (_) {}
    try { this.stompClient?.deactivate(); } catch (_) {}
    this.stompClient = null;
    this.stompSub = null;
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
        // Optimistic update — WebSocket will confirm the final state
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
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const slug = this.cart?.storeSlug || localStorage.getItem('storeSlug');
    if (!slug) { this.toastr.error('Could not determine store'); return; }
    localStorage.setItem('groupCartToken', this.token);
    localStorage.setItem('storeSlug', slug);
    this.router.navigate(['/store', slug]);
  }

  goToCheckout(): void {
    localStorage.setItem('checkoutGroupToken', this.token);
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
