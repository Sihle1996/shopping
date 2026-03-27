import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output
} from '@angular/core';
import mapboxgl from 'mapbox-gl';
import { environment } from 'src/environments/environment';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-driver-map',
  template: `
    <div class="relative w-full h-full rounded-xl overflow-hidden">
      <div [id]="mapId" class="h-full w-full"></div>

      <!-- Loading route -->
      <div *ngIf="!eta && !distance"
           class="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-card px-4 py-2">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-primary rounded-full animate-ping"></div>
          <span class="text-xs text-textMuted">Calculating route...</span>
        </div>
      </div>

      <!-- ETA / Distance / Next turn bar -->
      <div *ngIf="eta || distance"
           class="absolute top-3 left-3 right-14 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-card px-4 py-2.5">
        <div class="flex items-center gap-4 mb-1">
          <div *ngIf="distance" class="flex items-center gap-1.5">
            <i class="bi bi-signpost-2 text-primary text-sm"></i>
            <span class="text-xs font-semibold text-textDark">{{ distance }}</span>
          </div>
          <div *ngIf="eta" class="flex items-center gap-1.5">
            <i class="bi bi-clock text-primary text-sm"></i>
            <span class="text-xs font-semibold text-textDark">{{ eta }}</span>
          </div>
          <div *ngIf="selectedRouteIndex !== null && routeCount > 1" class="flex items-center gap-1.5">
            <span class="text-[10px] text-textMuted">Route {{ selectedRouteIndex + 1 }}/{{ routeCount }}</span>
          </div>
        </div>
        <!-- Next turn instruction -->
        <p *ngIf="nextInstruction" class="text-[11px] text-textLight truncate">
          <i class="bi bi-arrow-turn-right text-primary mr-1"></i>{{ nextInstruction }}
        </p>
      </div>

      <!-- Controls -->
      <div class="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button
          (click)="recenterMap()"
          class="w-10 h-10 bg-white rounded-full shadow-card flex items-center justify-center hover:bg-gray-50 transition-colors"
          title="Recenter">
          <i class="bi bi-crosshair text-primary"></i>
        </button>
        <button
          (click)="toggleVoice()"
          class="w-10 h-10 rounded-full shadow-card flex items-center justify-center transition-colors"
          [class]="voiceEnabled ? 'bg-primary text-white' : 'bg-white text-primary hover:bg-gray-50'"
          title="Voice">
          <i [class]="voiceEnabled ? 'bi bi-volume-up-fill' : 'bi bi-volume-mute'"></i>
        </button>
        <button
          (click)="toggleTraffic()"
          class="w-10 h-10 rounded-full shadow-card flex items-center justify-center transition-colors"
          [class]="showTraffic ? 'bg-primary text-white' : 'bg-white text-primary hover:bg-gray-50'"
          title="Traffic">
          <i class="bi bi-car-front"></i>
        </button>
        <button *ngIf="routeCount > 1"
          (click)="cycleRoute()"
          class="w-10 h-10 bg-white rounded-full shadow-card flex items-center justify-center hover:bg-gray-50 transition-colors"
          title="Alternative route">
          <i class="bi bi-shuffle text-primary"></i>
        </button>
      </div>

      <!-- Arrival banner -->
      <div *ngIf="isNearDestination"
           class="absolute bottom-4 left-3 right-3 z-10 bg-success text-white rounded-xl shadow-float px-4 py-3 text-center animate-bounce-in">
        <i class="bi bi-geo-alt-fill mr-2"></i>
        <span class="font-semibold text-sm">You have arrived at the destination!</span>
      </div>
    </div>
  `,
  styleUrls: ['./driver-map.component.scss']
})
export class DriverMapComponent implements AfterViewInit, OnDestroy {
  @Input() deliveryAddress!: string;
  @Input() mapId = 'map';
  @Output() mapLoaded = new EventEmitter<void>();
  @Output() arrived = new EventEmitter<void>();

  private map: mapboxgl.Map | null = null;
  private driverMarker: mapboxgl.Marker | null = null;
  private destinationMarker: mapboxgl.Marker | null = null;
  private watchId: number | null = null;
  private driverCoords: [number, number] | null = null;
  private destinationCoords: [number, number] | null = null;
  private prevCoords: [number, number] | null = null;
  private isFollowing = true;
  private initialFitDone = false;
  private allRoutes: any[] = [];
  private routeSteps: any[] = [];
  private lastSpokenStep = -1;
  private arrivalAnnounced = false;

  eta: string | null = null;
  distance: string | null = null;
  nextInstruction: string | null = null;
  showTraffic = false;
  voiceEnabled = true;
  selectedRouteIndex: number | null = null;
  routeCount = 0;
  isNearDestination = false;

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 100);
  }

  ngOnDestroy(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.map) { this.map.remove(); this.map = null; }
    speechSynthesis.cancel();
  }

  private initMap(): void {
    (mapboxgl as any).accessToken = environment.mapboxToken;

    this.map = new mapboxgl.Map({
      container: this.mapId,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [28.0473, -26.2041],
      zoom: 14,
      minZoom: 10,
      maxZoom: 19,
      pitch: 60,
      bearing: 0,
      maxBounds: [[24.0, -35.0], [33.0, -22.0]],
    });

    this.map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    this.map.on('dragstart', () => { this.isFollowing = false; });

    this.startTracking();

    this.map.on('load', () => {
      this.add3DBuildings();
      this.geocodeAndSetDestination();
      if (this.driverCoords && this.destinationCoords) this.drawRoute();
    });
  }

  private add3DBuildings(): void {
    if (!this.map) return;
    const layers = this.map.getStyle().layers;
    let labelLayerId: string | undefined;
    for (const layer of layers || []) {
      if (layer.type === 'symbol' && (layer.layout as any)?.['text-field']) {
        labelLayerId = layer.id;
        break;
      }
    }
    this.map.addLayer({
      id: '3d-buildings', source: 'composite', 'source-layer': 'building',
      filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 13,
      paint: {
        'fill-extrusion-color': '#c8c8c8',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.7
      }
    }, labelLayerId);
  }

  toggleTraffic(): void {
    if (!this.map) return;
    this.showTraffic = !this.showTraffic;
    if (this.showTraffic) {
      this.map.addSource('mapbox-traffic', { type: 'vector', url: 'mapbox://mapbox.mapbox-traffic-v1' });
      this.map.addLayer({
        id: 'traffic-layer', type: 'line', source: 'mapbox-traffic', 'source-layer': 'traffic',
        paint: {
          'line-width': 2,
          'line-color': ['match', ['get', 'congestion'], 'low', '#22C55E', 'moderate', '#F59E0B', 'heavy', '#EF4444', 'severe', '#991B1B', '#666']
        }
      });
    } else {
      if (this.map.getLayer('traffic-layer')) this.map.removeLayer('traffic-layer');
      if (this.map.getSource('mapbox-traffic')) this.map.removeSource('mapbox-traffic');
    }
  }

  toggleVoice(): void {
    this.voiceEnabled = !this.voiceEnabled;
    if (!this.voiceEnabled) speechSynthesis.cancel();
    else if (this.nextInstruction) this.speak(this.nextInstruction);
  }

  cycleRoute(): void {
    if (this.allRoutes.length <= 1) return;
    this.selectedRouteIndex = ((this.selectedRouteIndex ?? 0) + 1) % this.allRoutes.length;
    this.applyRoute(this.allRoutes[this.selectedRouteIndex]);
    this.speak(`Switching to route ${this.selectedRouteIndex + 1}`);
  }

  private geocodeAndSetDestination(): void {
    if (!this.deliveryAddress) return;
    const query = encodeURIComponent(this.deliveryAddress);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${environment.mapboxToken}&country=za&limit=1`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (res.features?.length > 0) {
          const [lng, lat] = res.features[0].center;
          this.destinationCoords = [lng, lat];

          const el = document.createElement('div');
          el.innerHTML = `<div class="w-10 h-10 rounded-full bg-red-500 border-3 border-white shadow-lg flex items-center justify-center">
            <svg width="16" height="16" fill="white" viewBox="0 0 16 16"><path d="M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A31.493 31.493 0 0 1 8 14.58a31.481 31.481 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.96-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94zM8 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>
          </div>`;

          this.destinationMarker = new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML('<b>Delivery Destination</b>'))
            .addTo(this.map!);

          this.fitBounds();
          this.mapLoaded.emit();
          if (this.driverCoords) this.drawRoute();
        }
      }
    });
  }

  private startTracking(): void {
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        const newCoords: [number, number] = [lng, lat];

        let bearing: number | null = null;
        if (this.prevCoords) bearing = this.calculateBearing(this.prevCoords, newCoords);
        this.prevCoords = [...newCoords];
        this.driverCoords = newCoords;

        if (this.driverMarker) {
          this.driverMarker.setLngLat(newCoords);
        } else {
          const el = document.createElement('div');
          el.innerHTML = `<div class="w-12 h-12 relative flex items-center justify-center">
            <div class="absolute w-12 h-12 bg-blue-500 rounded-full opacity-25 animate-ping"></div>
            <div class="w-7 h-7 bg-blue-600 rounded-full border-3 border-white shadow-lg z-10 flex items-center justify-center">
              <svg width="12" height="12" fill="white" viewBox="0 0 16 16"><path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>
            </div>
          </div>`;
          this.driverMarker = new mapboxgl.Marker(el).setLngLat(newCoords).addTo(this.map!);
        }

        if (!this.initialFitDone) { this.fitBounds(); this.initialFitDone = true; }

        if (this.isFollowing && this.map) {
          const options: any = { center: newCoords, zoom: 17.5, pitch: 65, duration: 1000, essential: true };
          if (bearing !== null) options.bearing = bearing;
          this.map.easeTo(options);
        }

        // Check arrival (within 80 meters)
        if (this.destinationCoords) {
          const dist = this.distanceBetween(newCoords, this.destinationCoords);
          if (dist < 0.08 && !this.arrivalAnnounced) {
            this.isNearDestination = true;
            this.arrivalAnnounced = true;
            this.arrived.emit();
            this.speak('You have arrived at the delivery destination.');
          }
        }

        // Update voice navigation
        this.updateVoiceNavigation();

        if (this.destinationCoords) this.drawRoute();
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
  }

  private calculateBearing(from: [number, number], to: [number, number]): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const dLon = toRad(to[0] - from[0]);
    const lat1 = toRad(from[1]);
    const lat2 = toRad(to[1]);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  private distanceBetween(a: [number, number], b: [number, number]): number {
    const R = 6371; // km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  private drawRoute(): void {
    if (!this.driverCoords || !this.destinationCoords || !this.map) return;

    const start = `${this.driverCoords[0]},${this.driverCoords[1]}`;
    const end = `${this.destinationCoords[0]},${this.destinationCoords[1]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start};${end}?geometries=geojson&overview=full&steps=true&alternatives=true&access_token=${environment.mapboxToken}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (!res.routes?.length) return;

        this.allRoutes = res.routes;
        this.routeCount = res.routes.length;
        if (this.selectedRouteIndex === null) this.selectedRouteIndex = 0;

        this.applyRoute(res.routes[this.selectedRouteIndex!]);

        // Draw alternative routes (gray)
        for (let i = 0; i < res.routes.length; i++) {
          if (i === this.selectedRouteIndex) continue;
          const altId = `route-alt-${i}`;
          if (this.map!.getSource(altId)) {
            (this.map!.getSource(altId) as mapboxgl.GeoJSONSource).setData(res.routes[i].geometry);
          } else {
            this.map!.addSource(altId, { type: 'geojson', data: res.routes[i].geometry });
            this.map!.addLayer({
              id: altId, type: 'line', source: altId,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#9CA3AF', 'line-width': 4, 'line-opacity': 0.4, 'line-dasharray': [2, 2] }
            });
          }
        }
      }
    });
  }

  private applyRoute(route: any): void {
    if (!this.map) return;

    const durationMin = Math.round(route.duration / 60);
    const distanceKm = (route.distance / 1000).toFixed(1);
    this.eta = durationMin < 60 ? `${durationMin} min` : `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;
    this.distance = `${distanceKm} km`;

    // Store steps for voice nav
    this.routeSteps = route.legs?.[0]?.steps || [];
    if (this.routeSteps.length > 0) {
      this.nextInstruction = this.routeSteps[0].maneuver?.instruction || null;
    }

    // Draw main route
    if (this.map.getSource('route')) {
      (this.map.getSource('route') as mapboxgl.GeoJSONSource).setData(route.geometry);
    } else {
      this.map.addSource('route', { type: 'geojson', data: route.geometry });
      this.map.addLayer({
        id: 'route-outline', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#1E40AF', 'line-width': 8, 'line-opacity': 0.3 }
      });
      this.map.addLayer({
        id: 'route', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 0.9 }
      });
    }
  }

  private updateVoiceNavigation(): void {
    if (!this.driverCoords || this.routeSteps.length === 0) return;

    for (let i = 0; i < this.routeSteps.length; i++) {
      const step = this.routeSteps[i];
      const maneuver = step.maneuver;
      if (!maneuver?.location) continue;

      const stepCoords: [number, number] = [maneuver.location[0], maneuver.location[1]];
      const dist = this.distanceBetween(this.driverCoords, stepCoords);

      // Announce when within 150 meters of next turn
      if (dist < 0.15 && i > this.lastSpokenStep) {
        this.lastSpokenStep = i;
        this.nextInstruction = maneuver.instruction;
        this.speak(maneuver.instruction);
        break;
      }
    }
  }

  private speak(text: string): void {
    if (!this.voiceEnabled || !text) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.lang = 'en-ZA';
    speechSynthesis.speak(utterance);
  }

  private fitBounds(): void {
    if (!this.map) return;
    if (this.driverCoords && this.destinationCoords) {
      const bounds = new mapboxgl.LngLatBounds().extend(this.driverCoords).extend(this.destinationCoords);
      this.map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
    } else if (this.driverCoords) {
      this.map.flyTo({ center: this.driverCoords, zoom: 14 });
    }
  }

  recenterMap(): void {
    this.isFollowing = true;
    if (this.map && this.driverCoords) {
      this.map.flyTo({ center: this.driverCoords, zoom: 17.5, pitch: 65, duration: 1200 });
    }
  }
}
