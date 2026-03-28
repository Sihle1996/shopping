import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import mapboxgl from 'mapbox-gl';
import { environment } from 'src/environments/environment';
import { HttpClient } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface DeliveryStop {
  id: string;
  address: string;
  label: string;
}

const ROUTE_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

@Component({
  selector: 'app-driver-map',
  template: `
    <div class="relative w-full h-full rounded-xl overflow-hidden">
      <div [id]="mapId" class="h-full w-full"></div>

      <!-- Loading -->
      <div *ngIf="!eta"
           class="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-card px-4 py-2">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-primary rounded-full animate-ping"></div>
          <span class="text-xs text-textMuted">Calculating route...</span>
        </div>
      </div>

      <!-- ETA / Distance / Stops -->
      <div *ngIf="eta"
           class="absolute top-3 left-3 right-14 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-card px-4 py-2.5">
        <div class="flex items-center gap-4 mb-1">
          <div class="flex items-center gap-1.5">
            <i class="bi bi-signpost-2 text-primary text-sm"></i>
            <span class="text-xs font-semibold text-textDark">{{ distance }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <i class="bi bi-clock text-primary text-sm"></i>
            <span class="text-xs font-semibold text-textDark">{{ eta }}</span>
          </div>
          <div *ngIf="totalStops > 1" class="flex items-center gap-1.5">
            <i class="bi bi-pin-map text-primary text-sm"></i>
            <span class="text-xs font-semibold text-textDark">{{ totalStops }} stops</span>
          </div>
        </div>
        <p *ngIf="nextInstruction" class="text-[11px] text-textLight truncate">
          <i class="bi bi-arrow-turn-right text-primary mr-1"></i>{{ nextInstruction }}
        </p>
      </div>

      <!-- Stop legend -->
      <div *ngIf="totalStops > 1"
           class="absolute bottom-4 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-card px-3 py-2 space-y-1">
        <div *ngFor="let stop of optimizedStops; let i = index" class="flex items-center gap-2 text-[10px]">
          <span class="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold text-[8px]"
                [style.backgroundColor]="getColor(i)">{{ i + 1 }}</span>
          <span class="text-textDark truncate max-w-[150px]">{{ stop.label }}</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button (click)="recenterMap()"
          class="w-10 h-10 bg-white rounded-full shadow-card flex items-center justify-center hover:bg-gray-50 transition-colors">
          <i class="bi bi-crosshair text-primary"></i>
        </button>
        <button (click)="toggleVoice()"
          class="w-10 h-10 rounded-full shadow-card flex items-center justify-center transition-colors"
          [class]="voiceEnabled ? 'bg-primary text-white' : 'bg-white text-primary hover:bg-gray-50'">
          <i [class]="voiceEnabled ? 'bi bi-volume-up-fill' : 'bi bi-volume-mute'"></i>
        </button>
        <button (click)="toggleTraffic()"
          class="w-10 h-10 rounded-full shadow-card flex items-center justify-center transition-colors"
          [class]="showTraffic ? 'bg-primary text-white' : 'bg-white text-primary hover:bg-gray-50'">
          <i class="bi bi-car-front"></i>
        </button>
      </div>

      <!-- Arrival banner -->
      <div *ngIf="isNearDestination"
           class="absolute bottom-4 right-3 left-3 z-10 bg-success text-white rounded-xl shadow-float px-4 py-3 text-center animate-bounce-in">
        <i class="bi bi-geo-alt-fill mr-2"></i>
        <span class="font-semibold text-sm">You have arrived!</span>
      </div>
    </div>
  `,
  styleUrls: ['./driver-map.component.scss']
})
export class DriverMapComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() deliveryAddress!: string;
  @Input() deliveryStops: DeliveryStop[] = [];
  @Input() mapId = 'map';
  @Output() mapLoaded = new EventEmitter<void>();
  @Output() arrived = new EventEmitter<string>();

  private map: mapboxgl.Map | null = null;
  private driverMarker: mapboxgl.Marker | null = null;
  private stopMarkers: mapboxgl.Marker[] = [];
  private watchId: number | null = null;
  private driverCoords: [number, number] | null = null;
  private prevCoords: [number, number] | null = null;
  private isFollowing = true;
  private initialFitDone = false;
  private routeSteps: any[] = [];
  private lastSpokenStep = -1;
  private arrivedStops = new Set<number>();
  private destroy$ = new Subject<void>();
  private routeSub: Subscription | null = null;
  private lastEaseTo = 0;
  private mapReady = false;
  private geocodingInProgress = false;

  optimizedStops: (DeliveryStop & { coords: [number, number] })[] = [];
  eta: string | null = null;
  distance: string | null = null;
  nextInstruction: string | null = null;
  totalStops = 0;
  showTraffic = false;
  voiceEnabled = true;
  isNearDestination = false;

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 100);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['deliveryStops'] || changes['deliveryAddress']) {
      // Reset so the next buildStops call re-geocodes fresh data
      this.eta = null;
      this.optimizedStops = [];
      this.buildStops();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.routeSub) { this.routeSub.unsubscribe(); this.routeSub = null; }
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.map) { this.map.remove(); this.map = null; }
    speechSynthesis.cancel();
  }

  getColor(i: number): string { return ROUTE_COLORS[i % ROUTE_COLORS.length]; }

  private initMap(): void {
    (mapboxgl as any).accessToken = environment.mapboxToken;
    this.map = new mapboxgl.Map({
      container: this.mapId, style: 'mapbox://styles/mapbox/streets-v12',
      center: [28.0473, -26.2041], zoom: 14, minZoom: 10, maxZoom: 19,
      pitch: 60, bearing: 0, maxBounds: [[24.0, -35.0], [33.0, -22.0]],
    });
    this.map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    this.map.on('dragstart', () => { this.isFollowing = false; });
    this.startTracking();
    this.map.on('load', () => {
      this.mapReady = true;
      this.add3DBuildings();
      if (this.optimizedStops.length > 0) {
        // Geocoding already finished while map was loading — render now
        this.clearStopMarkers();
        this.addStopMarkers();
        if (this.driverCoords && !this.eta) {
          this.optimizedStops.length > 1 ? this.fetchOptimizedRoute() : this.fetchSingleRoute();
        }
        this.fitAllBounds();
      } else if (!this.geocodingInProgress) {
        // Not yet started (ngOnChanges hasn't fired or had no data yet)
        this.buildStops();
      }
      // If geocodingInProgress, geocodeAllStops will render when it completes
    });
  }

  private buildStops(): void {
    if (this.geocodingInProgress) return;
    let stops: DeliveryStop[] = [];
    if (this.deliveryStops?.length > 0) stops = this.deliveryStops;
    else if (this.deliveryAddress) stops = [{ id: 'single', address: this.deliveryAddress, label: 'Delivery' }];
    if (stops.length === 0) return;
    this.totalStops = stops.length;
    this.geocodingInProgress = true;
    this.geocodeAllStops(stops);
  }

  private geocodeAllStops(stops: DeliveryStop[]): void {
    const promises = stops.map(stop => {
      const q = encodeURIComponent(stop.address);
      return this.http.get<any>(`https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${environment.mapboxToken}&country=za&limit=1`)
        .toPromise().then(res => res?.features?.length ? { ...stop, coords: res.features[0].center as [number, number] } : null);
    });

    Promise.all(promises).then(results => {
      this.geocodingInProgress = false;
      this.optimizedStops = results.filter(Boolean) as any[];
      if (this.mapReady && this.optimizedStops.length > 0) {
        // Map already loaded — render immediately
        this.clearStopMarkers();
        this.addStopMarkers();
        if (this.driverCoords && !this.eta) {
          this.optimizedStops.length > 1 ? this.fetchOptimizedRoute() : this.fetchSingleRoute();
        }
        this.fitAllBounds();
      }
      // If map not ready yet, the map 'load' handler will pick up optimizedStops
      this.mapLoaded.emit();
    });
  }

  private addStopMarkers(): void {
    this.optimizedStops.forEach((stop, i) => {
      const el = document.createElement('div');
      const color = this.getColor(i);
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:bold">${i + 1}</div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};margin-top:-2px"></div>
      </div>`;
      const marker = new mapboxgl.Marker(el).setLngLat(stop.coords)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<b>${stop.label}</b><br><span style="font-size:11px">${stop.address}</span>`))
        .addTo(this.map!);
      this.stopMarkers.push(marker);
    });
  }

  private clearStopMarkers(): void { this.stopMarkers.forEach(m => m.remove()); this.stopMarkers = []; }

  private fetchOptimizedRoute(): void {
    if (!this.driverCoords || !this.optimizedStops.length) return;
    if (this.routeSub) { this.routeSub.unsubscribe(); this.routeSub = null; }
    const coords = [`${this.driverCoords[0]},${this.driverCoords[1]}`, ...this.optimizedStops.map(s => `${s.coords[0]},${s.coords[1]}`)].join(';');
    const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}?source=first&roundtrip=false&geometries=geojson&overview=full&steps=true&access_token=${environment.mapboxToken}`;

    this.routeSub = this.http.get<any>(url).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (!res.trips?.length) return;
        const trip = res.trips[0];
        const durationMin = Math.round(trip.duration / 60);
        this.eta = durationMin < 60 ? `${durationMin} min` : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;
        this.distance = `${(trip.distance / 1000).toFixed(1)} km`;
        this.routeSteps = trip.legs?.flatMap((leg: any) => leg.steps || []) || [];
        if (this.routeSteps.length) this.nextInstruction = this.routeSteps[0].maneuver?.instruction || null;
        this.drawMultiLegRoute(trip);
        this.speak(`Route optimized. ${this.optimizedStops.length} stops, ${this.distance}, ${this.eta}.`);
      }
    });
  }

  private drawMultiLegRoute(trip: any): void {
    if (!this.map || !trip.legs) return;
    // Clean old layers
    for (let i = 0; i < 10; i++) {
      ['route-leg-', 'route-leg-outline-'].forEach(prefix => {
        if (this.map!.getLayer(prefix + i)) this.map!.removeLayer(prefix + i);
      });
      if (this.map.getSource(`route-leg-${i}`)) this.map.removeSource(`route-leg-${i}`);
    }
    ['route', 'route-outline'].forEach(id => { if (this.map!.getLayer(id)) this.map!.removeLayer(id); });
    if (this.map.getSource('route')) this.map.removeSource('route');

    // Full route shadow
    this.map.addSource('route', { type: 'geojson', data: trip.geometry });
    this.map.addLayer({ id: 'route-outline', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#1E40AF', 'line-width': 8, 'line-opacity': 0.15 } });

    // Each leg in different color
    trip.legs.forEach((leg: any, i: number) => {
      const coordinates: [number, number][] = [];
      (leg.steps || []).forEach((step: any) => { if (step.geometry?.coordinates) coordinates.push(...step.geometry.coordinates); });
      if (!coordinates.length) return;
      const src = `route-leg-${i}`;
      this.map!.addSource(src, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } } });
      this.map!.addLayer({ id: src, type: 'line', source: src, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ROUTE_COLORS[i % ROUTE_COLORS.length], 'line-width': 5, 'line-opacity': 0.85 } });
    });
  }

  private fetchSingleRoute(): void {
    if (!this.driverCoords || !this.optimizedStops.length) return;
    if (this.routeSub) { this.routeSub.unsubscribe(); this.routeSub = null; }
    const start = `${this.driverCoords[0]},${this.driverCoords[1]}`;
    const end = `${this.optimizedStops[0].coords[0]},${this.optimizedStops[0].coords[1]}`;
    this.routeSub = this.http.get<any>(`https://api.mapbox.com/directions/v5/mapbox/driving/${start};${end}?geometries=geojson&overview=full&steps=true&access_token=${environment.mapboxToken}`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (!res.routes?.length) return;
        const route = res.routes[0];
        const durationMin = Math.round(route.duration / 60);
        this.eta = durationMin < 60 ? `${durationMin} min` : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;
        this.distance = `${(route.distance / 1000).toFixed(1)} km`;
        this.routeSteps = route.legs?.[0]?.steps || [];
        if (this.routeSteps.length) this.nextInstruction = this.routeSteps[0].maneuver?.instruction || null;
        if (this.map!.getSource('route')) { (this.map!.getSource('route') as mapboxgl.GeoJSONSource).setData(route.geometry); }
        else {
          this.map!.addSource('route', { type: 'geojson', data: route.geometry });
          this.map!.addLayer({ id: 'route-outline', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#1E40AF', 'line-width': 8, 'line-opacity': 0.3 } });
          this.map!.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 0.9 } });
        }
      }
    });
  }

  private startTracking(): void {
    this.watchId = navigator.geolocation.watchPosition((pos) => {
      const newCoords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      let bearing: number | null = null;
      if (this.prevCoords) bearing = this.calcBearing(this.prevCoords, newCoords);
      this.prevCoords = [...newCoords];
      const firstFix = !this.driverCoords;
      this.driverCoords = newCoords;

      // Geocoding may have finished before GPS — trigger route fetch now that coords are available
      if (firstFix && this.optimizedStops.length > 0 && !this.eta) {
        this.optimizedStops.length > 1 ? this.fetchOptimizedRoute() : this.fetchSingleRoute();
      }

      if (this.driverMarker) { this.driverMarker.setLngLat(newCoords); }
      else {
        const el = document.createElement('div');
        el.innerHTML = `<div style="width:48px;height:48px;position:relative;display:flex;align-items:center;justify-content:center">
          <div style="position:absolute;width:48px;height:48px;background:#3B82F6;border-radius:50%;opacity:0.2;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>
          <div style="width:30px;height:30px;background:#2563EB;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);z-index:1;display:flex;align-items:center;justify-content:center">
            <svg width="14" height="14" fill="white" viewBox="0 0 16 16"><path d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z" transform="rotate(180 8 8)"/></svg>
          </div>
        </div>`;
        this.driverMarker = new mapboxgl.Marker(el).setLngLat(newCoords).addTo(this.map!);
      }

      if (!this.initialFitDone) { this.fitAllBounds(); this.initialFitDone = true; }
      const now = Date.now();
      if (this.isFollowing && this.map && (now - this.lastEaseTo) > 1000) {
        this.lastEaseTo = now;
        const opts: any = { center: newCoords, zoom: 17.5, pitch: 65, duration: 1000, essential: true };
        if (bearing !== null) opts.bearing = bearing;
        this.map.easeTo(opts);
      }
      this.checkArrivals(newCoords);
      this.updateVoiceNavigation();
    }, () => {}, { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 });
  }

  private checkArrivals(coords: [number, number]): void {
    this.optimizedStops.forEach((stop, i) => {
      if (this.arrivedStops.has(i)) return;
      if (this.distBetween(coords, stop.coords) < 0.08) {
        this.arrivedStops.add(i);
        this.isNearDestination = true;
        this.arrived.emit(stop.id);
        this.speak(`Arrived at stop ${i + 1}. ${stop.label}.`);
        setTimeout(() => this.isNearDestination = false, 5000);
      }
    });
  }

  private add3DBuildings(): void {
    if (!this.map) return;
    let labelId: string | undefined;
    for (const l of this.map.getStyle().layers || []) { if (l.type === 'symbol' && (l.layout as any)?.['text-field']) { labelId = l.id; break; } }
    this.map.addLayer({ id: '3d-buildings', source: 'composite', 'source-layer': 'building', filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 13, paint: { 'fill-extrusion-color': '#c8c8c8', 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'], 'fill-extrusion-opacity': 0.7 } }, labelId);
  }

  toggleTraffic(): void {
    if (!this.map) return;
    this.showTraffic = !this.showTraffic;
    if (this.showTraffic) {
      this.map.addSource('mapbox-traffic', { type: 'vector', url: 'mapbox://mapbox.mapbox-traffic-v1' });
      this.map.addLayer({ id: 'traffic-layer', type: 'line', source: 'mapbox-traffic', 'source-layer': 'traffic', paint: { 'line-width': 2, 'line-color': ['match', ['get', 'congestion'], 'low', '#22C55E', 'moderate', '#F59E0B', 'heavy', '#EF4444', 'severe', '#991B1B', '#666'] } });
    } else {
      if (this.map.getLayer('traffic-layer')) this.map.removeLayer('traffic-layer');
      if (this.map.getSource('mapbox-traffic')) this.map.removeSource('mapbox-traffic');
    }
  }

  toggleVoice(): void { this.voiceEnabled = !this.voiceEnabled; if (!this.voiceEnabled) speechSynthesis.cancel(); }

  private updateVoiceNavigation(): void {
    if (!this.driverCoords || !this.routeSteps.length) return;
    for (let i = 0; i < this.routeSteps.length; i++) {
      const m = this.routeSteps[i].maneuver;
      if (!m?.location) continue;
      if (this.distBetween(this.driverCoords, [m.location[0], m.location[1]]) < 0.15 && i > this.lastSpokenStep) {
        this.lastSpokenStep = i;
        this.nextInstruction = m.instruction;
        this.speak(m.instruction);
        break;
      }
    }
  }

  private speak(text: string): void {
    if (!this.voiceEnabled || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9; u.pitch = 1; u.lang = 'en-ZA';
    speechSynthesis.speak(u);
  }

  private calcBearing(from: [number, number], to: [number, number]): number {
    const r = (d: number) => (d * Math.PI) / 180;
    const dL = r(to[0] - from[0]);
    const y = Math.sin(dL) * Math.cos(r(to[1]));
    const x = Math.cos(r(from[1])) * Math.sin(r(to[1])) - Math.sin(r(from[1])) * Math.cos(r(to[1])) * Math.cos(dL);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  private distBetween(a: [number, number], b: [number, number]): number {
    const r = (d: number) => (d * Math.PI) / 180;
    const dLat = r(b[1] - a[1]), dLon = r(b[0] - a[0]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  private fitAllBounds(): void {
    if (!this.map) return;
    const b = new mapboxgl.LngLatBounds();
    if (this.driverCoords) b.extend(this.driverCoords);
    this.optimizedStops.forEach(s => b.extend(s.coords));
    if (!b.isEmpty()) this.map.fitBounds(b, { padding: 80, maxZoom: 15 });
  }

  recenterMap(): void {
    this.isFollowing = true;
    if (this.map && this.driverCoords) this.map.flyTo({ center: this.driverCoords, zoom: 17.5, pitch: 65, duration: 1200 });
  }
}
