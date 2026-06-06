import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-cookie-consent',
  templateUrl: './cookie-consent.component.html'
})
export class CookieConsentComponent implements OnInit {
  visible = false;

  ngOnInit(): void {
    this.visible = !localStorage.getItem('cookieConsent');
  }

  accept(): void {
    localStorage.setItem('cookieConsent', 'accepted');
    this.visible = false;
  }
}
