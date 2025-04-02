import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output
} from '@angular/core';
import 'leaflet';
import 'leaflet.awesome-markers';
declare const L: any;
import * as mapboxPolyline from '@mapbox/polyline';
import { GeocodingService } from 'src/app/services/geocoding.service';

@Component({
  selector: 'app-driver-map',
  template: `
    <div class="relative h-full w-full rounded shadow">
      <div [id]="mapId" class="h-full w-full rounded"></div>
      <button
        class="absolute top-3 right-3 z-50 bg-white text-black px-3 py-2 rounded-full shadow-lg hover:bg-gray-100 transition"
        (click)="recenterMap()"
        title="Recenter on you">
        📍
      </button>
    </div>
  `,
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
    if ((mapContainer as any)._leaflet_id != null) {
      (mapContainer as any)._leaflet_id = null;
    }

    const johannesburgBounds = L.latLngBounds(
      [-26.7, 27.5], // SW
      [-25.9, 28.3]  // NE
    );

    this.map = L.map(this.mapId, {
      maxBounds: johannesburgBounds,
      maxBoundsViscosity: 0.5,
      zoomControl: true,
      dragging: true
    }).setView([-26.2041, 28.0473], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.geocodeDeliveryAddress(this.deliveryAddress);

    this.watchId = navigator.geolocation.watchPosition(
      pos => {
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

  private geocodeDeliveryAddress(address: string) {
    const cleaned = this.cleanAddress(address);
    this.geocodingService.geocodeAddress(cleaned).subscribe({
      next: coords => {
        this.setDestination(coords.lat, coords.lon);
      },
      error: () => {
        // fallback: try reducing to street + city
        const fallback = this.getFallbackAddress(cleaned);
        this.geocodingService.geocodeAddress(fallback).subscribe({
          next: coords => this.setDestination(coords.lat, coords.lon),
          error: err => {
            console.error(`❌ Final geocoding attempt failed for: "${address}"`, err);
          }
        });
      }
    });
  }

  private setDestination(lat: number, lon: number) {
    this.destinationCoords = [lat, lon];
    L.marker(this.destinationCoords, { icon: this.destinationIcon() })
      .addTo(this.map!)
      .bindPopup('Delivery Destination')
      .openPopup();

    this.tryFitBounds();
    this.mapLoaded.emit();
  }

  private tryFitBounds(): void {
    if (this.driverCoords && this.destinationCoords && this.map) {
      setTimeout(() => {
        const bounds = L.latLngBounds([
          this.driverCoords!,
          this.destinationCoords!
        ]);
        this.map!.fitBounds(bounds, { padding: [40, 40] });
      }, 200);
    }
  }

  private drawRoute(start: [number, number], end: [number, number]): void {
    const request = new XMLHttpRequest();
    request.open('POST', 'http://localhost:8080/api/map/route');
    request.setRequestHeader('Accept', 'application/json');
    request.setRequestHeader('Content-Type', 'application/json');

    request.onreadystatechange = () => {
      if (request.readyState === 4) {
        try {
          const response = JSON.parse(request.responseText);
          if (!response.routes?.length) throw new Error('No route data found');
          const path = mapboxPolyline.decode(response.routes[0].geometry);

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

  recenterMap(): void {
    if (this.map && this.driverCoords) {
      this.map.flyTo(this.driverCoords, 16, {
        animate: true,
        duration: 1.2
      });
    }
  }

  private cleanAddress(address: string): string {
    return address
      .split(',')
      .map(p => p.trim())
      .filter((val, idx, arr) => val && arr.indexOf(val) === idx)
      .join(', ');
  }

  private getFallbackAddress(cleaned: string): string {
    const parts = cleaned.split(',').map(p => p.trim());
    return parts.slice(0, 2).join(', ');
  }

  private driverIcon(): L.Icon {
    return L.AwesomeMarkers.icon({
      icon: 'location-arrow',
      prefix: 'fa',
      markerColor: 'blue',
      iconColor: 'white',
      extraClasses: 'blinking-marker'
    });
  }

  private destinationIcon(): L.Icon {
    return L.AwesomeMarkers.icon({
      icon: 'box',
      prefix: 'fa',
      markerColor: 'red',
      iconColor: 'white'
    });
  }
}
