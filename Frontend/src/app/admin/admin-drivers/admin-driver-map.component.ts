import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';
import { Stomp } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import maplibregl, { Map, GeoJSONSource, LngLatLike } from 'maplibre-gl';
import { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { environment } from 'src/environments/environment';

interface DriverLocation {
  id: string;
  email: string;
  driverStatus: string;
  latitude: number;
  longitude: number;
  speed: number;
  lastPing: string;
}

@Component({
  selector: 'app-admin-driver-map',
  templateUrl: './admin-driver-map.component.html',
  styleUrls: ['./admin-driver-map.component.scss']
})
export class AdminDriverMapComponent implements AfterViewInit, OnDestroy {
  private map!: Map;
  private stompClient: any;
  private drivers: Record<string, any> = {};
  private replayLength = 5;
  private mapLoaded = false;
  selectedStatuses = new Set<string>(['AVAILABLE', 'UNAVAILABLE', 'ON_DELIVERY']);

  readonly STATUS_LIST = ['AVAILABLE', 'ON_DELIVERY', 'UNAVAILABLE'];

  constructor(private adminService: AdminService, private authService: AuthService) {}

  ngAfterViewInit(): void {
    this.initMap();
    this.loadInitialLocations();
    this.connectWebSocket();
  }

  ngOnDestroy(): void {
    if (this.stompClient) {
      this.stompClient.disconnect();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  toggleStatus(status: string): void {
    if (this.selectedStatuses.has(status)) {
      this.selectedStatuses.delete(status);
    } else {
      this.selectedStatuses.add(status);
    }
    if (this.mapLoaded) {
      this.refreshSource();
    }
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      AVAILABLE: 'Available',
      ON_DELIVERY: 'On Delivery',
      UNAVAILABLE: 'Offline'
    };
    return labels[status] ?? status;
  }

  getStatusDotClass(status: string): string {
    const classes: Record<string, string> = {
      AVAILABLE: 'bg-green-500',
      ON_DELIVERY: 'bg-orange-400',
      UNAVAILABLE: 'bg-gray-400'
    };
    return classes[status] ?? 'bg-gray-400';
  }

  getStatusActiveClass(status: string): string {
    const classes: Record<string, string> = {
      AVAILABLE: 'bg-green-50 text-green-700 border-green-200',
      ON_DELIVERY: 'bg-orange-50 text-orange-700 border-orange-200',
      UNAVAILABLE: 'bg-gray-100 text-gray-600 border-gray-200'
    };
    return classes[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  }

  private initMap(): void {
    this.map = new maplibregl.Map({
      container: 'adminDriverMap',
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [28.0473, -26.2041] as LngLatLike,
      zoom: 10
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');

    this.map.on('load', () => {
      this.mapLoaded = true;

      this.map.addSource('drivers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Driver circles — color by status
      this.map.addLayer({
        id: 'driver-circles',
        type: 'circle',
        source: 'drivers',
        paint: {
          'circle-color': [
            'match', ['get', 'driverStatus'],
            'AVAILABLE', '#22c55e',
            'ON_DELIVERY', '#f97316',
            '#94a3b8'
          ],
          'circle-radius': 10,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Driver initial label inside circle
      this.map.addLayer({
        id: 'driver-labels',
        type: 'symbol',
        source: 'drivers',
        layout: {
          'text-field': ['get', 'initial'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 10,
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      // Click popup
      this.map.on('click', 'driver-circles', e => {
        const feature = e.features && e.features[0];
        if (!feature) return;
        const id = feature.properties && feature.properties['id'];
        const driver = this.drivers[id];
        if (!driver) return;
        const coords = (feature.geometry as any)['coordinates'];
        new maplibregl.Popup({ offset: 14, closeButton: false })
          .setLngLat(coords as LngLatLike)
          .setHTML(this.popupHtml(driver))
          .addTo(this.map);
      });

      this.map.on('mouseenter', 'driver-circles', () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', 'driver-circles', () => {
        this.map.getCanvas().style.cursor = '';
      });

      // Apply any data that loaded before the map was ready
      this.refreshSource();
    });
  }

  private popupHtml(driver: any): string {
    const statusColor: Record<string, string> = {
      AVAILABLE: '#22c55e',
      ON_DELIVERY: '#f97316',
      UNAVAILABLE: '#94a3b8'
    };
    const color = statusColor[driver.driverStatus] ?? '#94a3b8';
    const label = driver.driverStatus === 'ON_DELIVERY' ? 'On Delivery'
      : driver.driverStatus === 'AVAILABLE' ? 'Available' : 'Offline';
    const speed = driver.speed > 0 ? `${driver.speed.toFixed(1)} km/h` : 'Stationary';
    const ping = driver.lastPing ? new Date(driver.lastPing).toLocaleTimeString() : 'N/A';
    return `
      <div style="font-family:sans-serif;min-width:160px;padding:4px 0">
        <p style="font-weight:700;font-size:13px;margin:0 0 6px">${driver.email}</p>
        <p style="margin:0 0 4px;font-size:12px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:5px"></span>
          ${label}
        </p>
        <p style="margin:0 0 2px;font-size:11px;color:#64748b">Speed: ${speed}</p>
        <p style="margin:0;font-size:11px;color:#64748b">Last ping: ${ping}</p>
      </div>`;
  }

  private loadInitialLocations(): void {
    this.adminService.getDriverLocations().subscribe((data: DriverLocation[]) => {
      data.forEach((d: DriverLocation) => {
        this.drivers[d.id] = { ...d, history: [[d.longitude, d.latitude]] };
      });
      if (this.mapLoaded) {
        this.refreshSource();
      }
    });
  }

  private connectWebSocket(): void {
    const socketFactory = () => new SockJS(`${environment.apiUrl}/ws`);
    this.stompClient = Stomp.over(socketFactory);
    this.stompClient.debug = () => {};
    const headers: { [key: string]: string } = {};
    const token = this.authService.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    this.stompClient.connect(headers, () => {
      this.stompClient.subscribe('/topic/drivers', (message: any) => {
        const loc: DriverLocation = JSON.parse(message.body);
        const driver = this.drivers[loc.id] || { history: [] };
        driver.email = loc.email;
        driver.driverStatus = loc.driverStatus;
        driver.speed = loc.speed;
        driver.lastPing = loc.lastPing;
        driver.history.push([loc.longitude, loc.latitude]);
        if (driver.history.length > this.replayLength) {
          driver.history.shift();
        }
        this.drivers[loc.id] = driver;
        if (this.mapLoaded) {
          this.refreshSource();
          this.updateRoute(loc.id);
        }
      });
    });
  }

  private refreshSource(): void {
    const features: Feature<Point>[] = Object.values(this.drivers)
      .filter((d: any) => this.selectedStatuses.has(d.driverStatus))
      .map((d: any) => ({
        type: 'Feature',
        properties: {
          id: d.id,
          driverStatus: d.driverStatus,
          email: d.email,
          initial: (d.email || '?').charAt(0).toUpperCase()
        },
        geometry: {
          type: 'Point',
          coordinates: d.history[d.history.length - 1]
        }
      } as Feature<Point>));

    const source = this.map.getSource('drivers') as GeoJSONSource;
    if (source) {
      const collection: FeatureCollection<Point> = { type: 'FeatureCollection', features };
      source.setData(collection);
    }
  }

  private updateRoute(id: string): void {
    const driver = this.drivers[id];
    if (!driver || driver.history.length < 2) return;
    const routeId = `route-${id}`;
    const data: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: driver.history }
    };
    if (this.map.getSource(routeId)) {
      (this.map.getSource(routeId) as GeoJSONSource).setData(data);
    } else {
      this.map.addSource(routeId, { type: 'geojson', data });
      this.map.addLayer({
        id: routeId,
        type: 'line',
        source: routeId,
        paint: { 'line-color': '#f97316', 'line-width': 2, 'line-opacity': 0.7 }
      });
    }
  }
}
