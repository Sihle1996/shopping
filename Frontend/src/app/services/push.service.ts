import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { initializeApp, getApps } from 'firebase/app';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class PushService {
  private messaging?: Messaging;
  private swRegistration?: ServiceWorkerRegistration;

  constructor(private toastr: ToastrService, private http: HttpClient) {}

  async init(): Promise<void> {
    try {
      if (!('Notification' in window)) {
        return; // Not supported
      }

      // Lazy ask for permission the first time we initialize
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      // Ensure Firebase app is initialized (in case main.ts failed earlier)
      if (getApps().length === 0) {
        initializeApp(environment.firebase);
      }

      // Register service worker for messaging (relative path works in dev and prod)
      this.swRegistration = await navigator.serviceWorker.register('firebase-messaging-sw.js');

      this.messaging = getMessaging();
      const vapidKey = environment.firebase.vapidKey;

      const token = await getToken(this.messaging, {
        vapidKey,
        serviceWorkerRegistration: this.swRegistration
      });

      if (token) {
        console.log('FCM token:', token);
        // Only send to backend if user is authenticated (JWT present)
        const jwt = localStorage.getItem('token');
        if (jwt) {
          try {
            await this.http.post('http://localhost:8080/api/push/register-fcm', { token }).toPromise();
          } catch (e) {
            console.error('Failed to register FCM token with backend', e);
          }
        }
      }

      // Foreground messages
      onMessage(this.messaging, (payload) => {
        const title = payload?.notification?.title ?? 'Notification';
        const body = payload?.notification?.body ?? '';
        this.toastr.info(body, title, { timeOut: 5000, progressBar: true });
      });
    } catch (err) {
      console.error('Push init failed:', err);
    }
  }

  async unregister(): Promise<void> {
    try {
      await this.http.delete('http://localhost:8080/api/push/register-fcm').toPromise();
    } catch (e) {
      console.warn('Failed to unregister FCM token on backend (may already be removed).');
    }
  }
}
