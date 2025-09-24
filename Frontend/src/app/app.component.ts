import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { PushService } from './services/push.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],

})
export class AppComponent implements OnInit {
  title = 'App';
  isAdminRoute = false;

  constructor(private router: Router, private push: PushService) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isAdminRoute = event.urlAfterRedirects.startsWith('/admin');
      }
    });
  }

  ngOnInit(): void {
    // Initialize web push (requests permission lazily inside service)
    this.push.init();
  }
}
