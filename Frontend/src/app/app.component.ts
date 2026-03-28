import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'App';
  isAdminRoute = false;
  isDriverRoute = false;
  isAuthRoute = false;
  isStoreRoute = false;

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects;
      this.isAdminRoute = url.startsWith('/admin');
      this.isDriverRoute = url.startsWith('/driver');
      this.isAuthRoute = url.startsWith('/login') || url.startsWith('/register');
      this.isStoreRoute = url.startsWith('/store/');

    });
  }
}
