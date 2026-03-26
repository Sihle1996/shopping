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
    <div class="relative h-full w-full rounded-xl overflow-hidden">
      <div [id]="mapId" class="h-full w-full"></div>
      <button
        class="absolute top-3 right-3 z-10 w-10 h-10 bg-white rounded-full shadow-card
               flex items-center justify-center hover:bg-gray-50 transition-colors"
        (click)="recenterMap()"
        title="Recenter on you">
        <i class="bi bi-crosshair text-primary"></i>
      </button>
    </div>
  `,
  styleUrls: ['./driver-map.component.scss']
})
export class DriverMapComponent implements AfterViewInit, OnDestroy {
  @Input() deliveryAddress!: string;
  @Input() mapId = 'map';
  @Output() mapLoaded = new EventEmitter<void>();

  private map: mapboxgl.Map | null = null;
  private driverMarker: mapboxgl.Marker | null = null;
  private destinationMarker: mapboxgl.Marker | null = null;
  private watchId: number | null = null;
  private driverCoords: [number, number] | null = null; // [lng, lat]
  private destinationCoords: [number, number] | null = null; // [lng, lat]

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 100);
  }

  ngOnDestroy(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMap(): void {
    (mapboxgl as any).accessToken = environment.mapboxToken;

    this.map = new mapboxgl.Map({
      container: this.mapId,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [28.0473, -26.2041], // Johannesburg
      zoom: 12,
    });

    this.map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    this.map.on('load', () => {
      this.geocodeAndSetDestination();
      this.startTracking();
    });
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

          // Destination marker (red)
          const el = document.createElement('div');
          el.className = 'w-8 h-8 bg-danger rounded-full border-2 border-white shadow-md flex items-center justify-center';
          el.innerHTML = '<i class="bi bi-geo-alt-fill text-white text-sm"></i>';

          this.destinationMarker = new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText('Delivery Destination'))
            .addTo(this.map!);

          this.fitBounds();
          this.mapLoaded.emit();
        }
      }
    });
  }

  private startTracking(): void {
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        this.driverCoords = [lng, lat];

        if (this.driverMarker) {
          this.driverMarker.setLngLat([lng, lat]);
        } else {
          // Driver marker (blue pulse)
          const el = document.createElement('div');
          el.className = 'driver-marker';
          el.innerHTML = `
            <div class="w-10 h-10 relative flex items-center justify-center">
              <div class="absolute w-10 h-10 bg-blue-500 rounded-full opacity-30 animate-ping"></div>
              <div class="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-md z-10"></div>
            </div>
          `;

          this.driverMarker = new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .addTo(this.map!);
        }

        this.fitBounds();

        if (this.destinationCoords) {
          this.drawRoute();
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }

  private drawRoute(): void {
    if (!this.driverCoords || !this.destinationCoords || !this.map) return;

    const start = `${this.driverCoords[0]},${this.driverCoords[1]}`;
    const end = `${this.destinationCoords[0]},${this.destinationCoords[1]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start};${end}?geometries=geojson&overview=full&access_token=${environment.mapboxToken}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (!res.routes?.length) return;

        const route = res.routes[0].geometry;

        if (this.map!.getSource('route')) {
          (this.map!.getSource('route') as mapboxgl.GeoJSONSource).setData(route);
        } else {
          this.map!.addSource('route', {
            type: 'geojson',
            data: route
          });

          this.map!.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3B82F6',
              'line-width': 5,
              'line-opacity': 0.8
            }
          });
        }
      }
    });
  }

  private fitBounds(): void {
    if (!this.map) return;

    if (this.driverCoords && this.destinationCoords) {
      const bounds = new mapboxgl.LngLatBounds()
        .extend(this.driverCoords)
        .extend(this.destinationCoords);
      this.map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    } else if (this.driverCoords) {
      this.map.flyTo({ center: this.driverCoords, zoom: 14 });
    }
  }

  recenterMap(): void {
    if (this.map && this.driverCoords) {
      this.map.flyTo({ center: this.driverCoords, zoom: 16, duration: 1200 });
    }
  }
}
