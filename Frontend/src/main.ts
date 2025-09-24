import './polyfills';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { environment } from './environments/environment';

// Initialize Firebase early at app startup.
try {
  const app = initializeApp(environment.firebase);
  // Analytics only if supported (avoids SSR/build-time issues)
  isSupported().then((supported) => {
    if (supported && environment.firebase.measurementId) {
      try { getAnalytics(app); } catch {}
    }
  });
} catch (e) {
  console.error('Firebase init error:', e);
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
