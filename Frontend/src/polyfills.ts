// src/polyfills.ts
import 'zone.js'; // Angular's zone.js stays here
import process from 'process';
import { Buffer } from 'buffer';

// Make Node-ish globals available before any libs run
(window as any).global = window;      // fixes "global is not defined"
(window as any).process = process;    // fixes process / nextTick usage
(window as any).Buffer = Buffer;      // fixes Buffer usage

// Optional: sanity check (remove later)
console.log('Polyfills loaded:', !!(window as any).global, !!(window as any).process, !!(window as any).Buffer);
