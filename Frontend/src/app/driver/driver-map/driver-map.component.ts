import {
  AfterViewInit,
  Component,
  Input,
  OnDestroy
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

  private map: L.Map | null = null;
  private driverMarker: L.Marker | null = null;
  private routeLine: L.Polyline | null = null;
  private watchId: number | null = null;
  private destinationCoords: [number, number] | null = null;

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

    this.map = L.map(this.mapId, {
      maxBounds: L.latLngBounds(
        [-26.4700, 27.7580],
        [-26.4450, 27.7800]
      ),
      maxBoundsViscosity: 1.0
    }).setView([-26.4568, 27.7670], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // Geocode destination address
    this.geocodingService.geocodeAddress(this.deliveryAddress).subscribe(
      coords => {
        this.destinationCoords = [coords.lat, coords.lon];
        L.marker(this.destinationCoords, { icon: this.destinationIcon() })
          .addTo(this.map!)
          .bindPopup('Delivery Destination')
          .openPopup();
      },
      err => {
        console.error(`❌ Geocoding failed for "${this.deliveryAddress}":`, err);
      }
    );

    // Watch driver position
    this.watchId = navigator.geolocation.watchPosition(
      pos => {
        const driverCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude];

        if (this.driverMarker) {
          this.driverMarker.setLatLng(driverCoords);
        } else {
          this.driverMarker = L.marker(driverCoords, { icon: this.driverIcon() })
            .addTo(this.map!)
            .bindPopup('You are here')
            .openPopup();
        }

        this.map!.setView(driverCoords, 15);

        if (this.destinationCoords) {
          this.drawRoute(
            [driverCoords[1], driverCoords[0]],
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

          if (this.routeLine) this.map!.removeLayer(this.routeLine);

          this.routeLine = L.polyline(path as L.LatLngTuple[], {
            color: 'blue',
            weight: 4
          }).addTo(this.map!);
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
