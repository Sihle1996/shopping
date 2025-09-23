import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from "./components/navbar/navbar.component";
import { AdminFooterComponent } from "./admin/admin-footer/admin-footer.component";
import { FooterComponent } from "./components/footer/footer.component";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],

})
export class AppComponent {
  title = 'App';
  isAdminRoute = false;

  constructor(private router: Router) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isAdminRoute = event.urlAfterRedirects.startsWith('/admin');
      }
    });
  }
}
