import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private api = environment.apiUrl;
  private vapidPublicKey = '';
  private swReg: ServiceWorkerRegistration | null = null;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken()}` });
  }

  get isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  async init(): Promise<void> {
    if (!this.isSupported) return;
    try {
      const res = await this.http.get<{ publicKey: string }>(`${this.api}/api/push/public-key`).toPromise();
      this.vapidPublicKey = res?.publicKey || '';
      if (!this.vapidPublicKey) return;

      this.swReg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
    } catch (e) {
      console.warn('Push init failed:', e);
    }
  }

  async subscribe(): Promise<boolean> {
    if (!this.isSupported || !this.swReg || !this.vapidPublicKey) return false;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const sub = await this.swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      const json = sub.toJSON();
      await this.http.post(`${this.api}/api/push/subscribe`, {
        endpoint: json.endpoint,
        p256dh: json.keys?.['p256dh'],
        auth: json.keys?.['auth']
      }, { headers: this.headers() }).toPromise();

      return true;
    } catch (e) {
      console.warn('Push subscribe failed:', e);
      return false;
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.isSupported || !this.swReg) return;
    try {
      const sub = await this.swReg.pushManager.getSubscription();
      if (!sub) return;
      await this.http.delete(`${this.api}/api/push/unsubscribe`, {
        headers: this.headers(),
        body: { endpoint: sub.endpoint }
      } as any).toPromise();
      await sub.unsubscribe();
    } catch (e) {
      console.warn('Push unsubscribe failed:', e);
    }
  }

  async getSubscriptionState(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
    if (!this.isSupported) return 'unsupported';
    if (!this.swReg) return 'default';
    const sub = await this.swReg.pushManager.getSubscription();
    if (sub) return 'granted';
    return Notification.permission as 'granted' | 'denied' | 'default';
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }
}
