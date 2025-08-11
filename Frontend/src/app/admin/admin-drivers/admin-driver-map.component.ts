import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';
import { Stomp } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import maplibregl, { Map, GeoJSONSource, LngLatLike } from 'maplibre-gl';
import { Feature, FeatureCollection, LineString, Point } from 'geojson';

interface DriverLocation {
  id: number;
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
  private drivers: Record<number, any> = {};
  private replayLength = 5;
  selectedStatuses = new Set<string>(['AVAILABLE', 'UNAVAILABLE']);

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

  toggleStatus(status: string, event: any): void {
    if (event.target.checked) {
      this.selectedStatuses.add(status);
    } else {
      this.selectedStatuses.delete(status);
    }
    this.refreshSource();
  }

  private initMap(): void {
    this.map = new maplibregl.Map({
      container: 'adminDriverMap',
      style: 'https://demotiles.maplibre.org/style.json',
      center: [28.0473, -26.2041] as LngLatLike,
      zoom: 9
    });

    this.map.on('load', () => {
      this.map.addSource('drivers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      });

      this.map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'drivers',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#51bbd6',
          'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 25, 25]
        }
      });

      this.map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'drivers',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Bold'],
          'text-size': 12
        }
      });

      this.map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'drivers',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#11b4da',
          'circle-radius': 8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      });

      this.map.on('click', 'unclustered-point', e => {
        const feature = e.features && e.features[0];
        if (!feature) return;
        const id = feature.properties && feature.properties['id'];
        const driver = this.drivers[id];
        if (!driver) return;
        const coords = (feature.geometry as any)['coordinates'];
        new maplibregl.Popup()
          .setLngLat(coords as LngLatLike)
          .setHTML(this.popupHtml(driver))
          .addTo(this.map);
      });
    });
  }

  private popupHtml(driver: any): string {
    const eta = driver.speed > 0 && driver.history.length > 1
      ? (this.computeDistance(driver.history.at(-2), driver.history.at(-1)) / driver.speed * 60).toFixed(1)
      : 'N/A';
    return `<div><strong>${driver.email}</strong><br>Status: ${driver.driverStatus}<br>Speed: ${driver.speed?.toFixed(1) || '0'} km/h<br>ETA: ${eta} min</div>`;
  }

  private computeDistance(a: [number, number], b: [number, number]): number {
    const toRad = (n: number) => (n * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const aVal = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  }

  private loadInitialLocations(): void {
    this.adminService.getDriverLocations().subscribe((data: DriverLocation[]) => {
      data.forEach((d: DriverLocation) => {
        this.drivers[d.id] = { ...d, history: [[d.longitude, d.latitude]] };
      });
      this.refreshSource();
    });
  }

  private connectWebSocket(): void {
    const socket = new SockJS('/ws');
    this.stompClient = Stomp.over(socket);
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
        this.refreshSource();
        this.updateRoute(loc.id);
      });
    });
  }

  private refreshSource(): void {
    const features: Feature<Point>[] = Object.values(this.drivers)
      .filter((d: any) => this.selectedStatuses.has(d.driverStatus))
      .map((d: any) => ({
        type: 'Feature',
        properties: { id: d.id, driverStatus: d.driverStatus, email: d.email },
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

  private updateRoute(id: number): void {
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
        paint: { 'line-color': '#f00', 'line-width': 2 }
      });
    }
  }
}

