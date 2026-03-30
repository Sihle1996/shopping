import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  private orsApiKey = '5b3ce3597851110001cf62486eb46190526c4d34b70f6499f1ba52c2';
  private userLat: number | null = null;
  private userLon: number | null = null;

  constructor(private http: HttpClient) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.userLat = pos.coords.latitude;
          this.userLon = pos.coords.longitude;
        },
        () => {}
      );
    }
  }

  /**
   * Geocode address (with fallback on failure)
   */
  geocodeAddress(address: string): Observable<{ lat: number; lon: number }> {
    const cleaned = this.cleanAddress(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleaned)}`;
  
    return this.http.get<any[]>(url).pipe(
      switchMap(results => {
        if (results.length > 0) {
          return new Observable<{ lat: number; lon: number }>(observer => {
            observer.next({
              lat: parseFloat(results[0].lat),
              lon: parseFloat(results[0].lon)
            });
            observer.complete();
          });
        } else {
          const fallback = this.generateFallbackAddress(cleaned);
          const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallback)}`;
          return this.http.get<any[]>(fallbackUrl).pipe(
            map(fallbackResults => {
              if (fallbackResults.length === 0) {
                throw new Error(`No results found for: ${cleaned}. Fallback to: ${fallback}`);
              }
              return {
                lat: parseFloat(fallbackResults[0].lat),
                lon: parseFloat(fallbackResults[0].lon)
              };
            })
          );
        }
      })
    );
  }
  

  /**
   * Fallback address generator (use first 2 parts)
   */
  private generateFallbackAddress(address: string): string {
    const parts = address.split(',').map(p => p.trim());
    return parts.slice(0, 2).join(', ');
  }

  /**
   * Remove duplicate segments
   */
  private cleanAddress(address: string): string {
    return address
      .split(',')
      .map(p => p.trim())
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .join(', ');
  }

  /**
   * OpenRouteService autocomplete
   */
  autocomplete(query: string): Observable<{
    label: string;
    street?: string;
    city?: string;
    zip?: string;
    country?: string;
    lat: number;
    lon: number;
  }[]> {
    const focusParams = this.userLat && this.userLon
      ? `&focus.point.lat=${this.userLat}&focus.point.lon=${this.userLon}`
      : '';
    const url = `https://api.openrouteservice.org/geocode/autocomplete?api_key=${this.orsApiKey}&text=${encodeURIComponent(query)}&boundary.country=ZA${focusParams}`;

    return this.http.get<any>(url).pipe(
      map(response =>
        response.features.map((f: any) => ({
          label: f.properties.label,
          street: f.properties.street,
          city: f.properties.locality,
          zip: f.properties.postalcode || '',
          country: f.properties.country,
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0]
        }))
      )
    );
  }

  /**
   * Reverse geocode (Nominatim)
   */
  reverseGeocode(lat: number, lon: number): Observable<any> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    return this.http.get<any>(url);
  }

  /**
   * Reverse geocode via Mapbox — better postcode coverage for SA townships
   */
  reverseGeocodeMapbox(lat: number, lon: number): Observable<string> {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?types=postcode&access_token=${environment.mapboxToken}&country=za`;
    return this.http.get<any>(url).pipe(
      map(res => res?.features?.[0]?.text || '')
    );
  }

  /**
   * Get route between 2 points (backend proxy)
   */
  getRoute(start: [number, number], end: [number, number]): Observable<any> {
    return this.http.post(`${environment.apiUrl}/api/map/route`, {
      coordinates: [start, end]
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
