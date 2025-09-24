/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// Note: This file is copied to the output root by angular.json assets config.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBbgh5BnPYsuiFASy8nQR8cgTp-sCBq87A",
  authDomain: "push-4cedd.firebaseapp.com",
  projectId: "push-4cedd",
  storageBucket: "push-4cedd.firebasestorage.app",
  messagingSenderId: "322450207295",
  appId: "1:322450207295:web:f3b802e85d43df845e3e8a",
  measurementId: "G-QRXK85JP7N"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload?.notification?.title || 'Notification';
  const notificationOptions = {
    body: payload?.notification?.body || '',
    icon: '/favicon.ico'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
