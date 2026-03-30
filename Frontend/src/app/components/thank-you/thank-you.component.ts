import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-thank-you',
  templateUrl: './thank-you.component.html',
  styleUrls: ['./thank-you.component.scss']
})
export class ThankYouComponent implements OnInit {
  menuRoute = '/';
  ordersRoute = '/orders';

  constructor(private router: Router) {}

  ngOnInit(): void {
    const slug = localStorage.getItem('storeSlug');
    this.menuRoute = slug ? `/store/${slug}` : '/';
    this.ordersRoute = slug ? `/store/${slug}/orders` : '/orders';

    // Auto-redirect after 5 seconds
    setTimeout(() => this.router.navigateByUrl(this.menuRoute), 5000);
  }

  goToMenu(): void {
    this.router.navigateByUrl(this.menuRoute);
  }

  goToOrders(): void {
    this.router.navigateByUrl(this.ordersRoute);
  }
}
