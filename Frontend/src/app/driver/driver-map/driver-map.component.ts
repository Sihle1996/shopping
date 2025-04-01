import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output
} from '@angular/core';
import * as L from 'leaflet';
import * as mapboxPolyline from '@mapbox/polyline';
import { GeocodingService } from 'src/app/services/geocoding.service';

@Component({
  selector: 'app-driver-map',
  template: `<div [id]="mapId" class="h-full w-full rounded shadow"></div>`,
  styleUrls: ['./driver-map.component.scss']
})
export class DriverMapComponent implements AfterViewInit, OnDestroy {
  @Input() deliveryAddress!: string;
  @Input() mapId: string = 'map';
  @Output() mapLoaded = new EventEmitter<void>();

  private map: L.Map | null = null;
  private driverMarker: L.Marker | null = null;
  private routeLine: L.Polyline | null = null;
  private watchId: number | null = null;
  private destinationCoords: [number, number] | null = null;
  private driverCoords: [number, number] | null = null;

  constructor(private geocodingService: GeocodingService) {}

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 0);
  }

  ngOnDestroy(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMap(): void {
    const mapContainer = L.DomUtil.get(this.mapId) as HTMLElement;
    if (mapContainer && (mapContainer as any)._leaflet_id != null) {
      (mapContainer as any)._leaflet_id = null;
    }

    const johannesburgBounds = L.latLngBounds(
      [-26.7, 27.5], // Southwest
      [-25.9, 28.3]  // Northeast
    );

    this.map = L.map(this.mapId, {
      maxBounds: johannesburgBounds,
      maxBoundsViscosity: 0.5,
      zoomControl: true,
      dragging: true
    });

    this.map.setView([-26.2041, 28.0473], 12); // Johannesburg CBD fallback

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.geocodingService.geocodeAddress(this.deliveryAddress).subscribe(
      coords => {
        this.destinationCoords = [coords.lat, coords.lon];
        L.marker(this.destinationCoords, { icon: this.destinationIcon() })
          .addTo(this.map!)
          .bindPopup('Delivery Destination')
          .openPopup();

        this.tryFitBounds();
        this.mapLoaded.emit(); // Notify parent that map is ready
      },
      err => {
        console.error(`❌ Geocoding failed for "${this.deliveryAddress}":`, err);
      }
    );

    this.watchId = navigator.geolocation.watchPosition(
      pos => {
        console.log('📍 GPS Position:', pos);
        this.driverCoords = [pos.coords.latitude, pos.coords.longitude];

        if (this.driverMarker) {
          this.driverMarker.setLatLng(this.driverCoords);
        } else {
          this.driverMarker = L.marker(this.driverCoords, { icon: this.driverIcon() })
            .addTo(this.map!)
            .bindPopup('You are here')
            .openPopup();
        }

        this.tryFitBounds();

        if (this.destinationCoords) {
          this.drawRoute(
            [this.driverCoords[1], this.driverCoords[0]],
            [this.destinationCoords[1], this.destinationCoords[0]]
          );
        }
      },
      err => {
        console.error('❌ GPS Error:', err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }

  private tryFitBounds(): void {
    if (this.driverCoords && this.destinationCoords && this.map) {
      setTimeout(() => {
        const bounds = L.latLngBounds([
          this.driverCoords!,
          this.destinationCoords!
        ]);
        this.map!.fitBounds(bounds, { padding: [40, 40] });
      }, 200); // delay to let map fully render
    }
  }

  private drawRoute(start: [number, number], end: [number, number]): void {
    const request = new XMLHttpRequest();
    const token = '5b3ce3597851110001cf62486eb46190526c4d34b70f6499f1ba52c2';

    request.open('POST', 'https://api.openrouteservice.org/v2/directions/driving-car');
    request.setRequestHeader('Accept', 'application/json');
    request.setRequestHeader('Content-Type', 'application/json');
    request.setRequestHeader('Authorization', token);

    request.onreadystatechange = () => {
      if (request.readyState === 4) {
        try {
          const response = JSON.parse(request.responseText);
          if (!response.routes?.length) throw new Error('No route data found');

          const path: [number, number][] = mapboxPolyline.decode(response.routes[0].geometry);

          setTimeout(() => {
            if (this.routeLine) this.map!.removeLayer(this.routeLine);

            this.routeLine = L.polyline(path as L.LatLngTuple[], {
              color: 'blue',
              weight: 4
            }).addTo(this.map!);

            const bounds = L.latLngBounds(path.map(p => L.latLng(p[0], p[1])));
            this.map!.fitBounds(bounds, { padding: [30, 30] });
          }, 100);
        } catch (err) {
          console.error('❌ Failed to parse routing response:', err, request.responseText);
        }
      }
    };

    request.send(JSON.stringify({ coordinates: [start, end] }));
  }

  private driverIcon(): L.Icon {
    return L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/1946/1946775.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30]
    });
  }

  private destinationIcon(): L.Icon {
    return L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
      iconSize: [30, 30],
      iconAnchor: [15, 30]
    });
  }
}
