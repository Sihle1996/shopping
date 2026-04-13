import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface AddressSuggestion {
  label: string;       // Full formatted address shown to user
  name: string;        // Short name (building name or street name)
  street?: string;     // Street component
  city?: string;
  zip?: string;
  lat: number;
  lon: number;
  isPoi: boolean;      // true = business/POI, false = street address
}

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
   * Main autocomplete — uses Mapbox (better SA coverage + POI support)
   * Falls back to ORS if Mapbox token is not configured.
   */
  autocomplete(query: string): Observable<AddressSuggestion[]> {
    if (environment.mapboxToken) {
      return this.autocompleteMapbox(query).pipe(
        catchError(() => this.autocompleteORS(query))
      );
    }
    return this.autocompleteORS(query);
  }

  /**
   * Mapbox Geocoding — includes street addresses AND business POIs.
   * Much better coverage for South African addresses, suburbs and townships.
   */
  private autocompleteMapbox(query: string): Observable<AddressSuggestion[]> {
    const proximity = (this.userLat && this.userLon)
      ? `&proximity=${this.userLon},${this.userLat}`
      : '';
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${environment.mapboxToken}&country=za&types=address,poi&limit=8${proximity}`;

    return this.http.get<any>(url).pipe(
      map(response => (response.features || []).map((f: any) => {
        const ctx: any[] = f.context || [];
        const postcode = ctx.find((c: any) => c.id?.startsWith('postcode'))?.text || '';
        const city = ctx.find((c: any) =>
          c.id?.startsWith('place') || c.id?.startsWith('locality')
        )?.text || '';
        const isPoi = f.place_type?.[0] === 'poi';
        // For POIs, the street address is in properties.address; for address types it's the place_name
        const street = isPoi ? (f.properties?.address || f.place_name) : f.place_name;

        return {
          label: f.place_name,
          name: f.text,   // short name: building name or street name
          street,
          city,
          zip: postcode,
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          isPoi
        } as AddressSuggestion;
      }))
    );
  }

  /**
   * OpenRouteService fallback autocomplete
   */
  private autocompleteORS(query: string): Observable<AddressSuggestion[]> {
    const focusParams = (this.userLat && this.userLon)
      ? `&focus.point.lat=${this.userLat}&focus.point.lon=${this.userLon}`
      : '';
    const url = `https://api.openrouteservice.org/geocode/autocomplete?api_key=${this.orsApiKey}` +
      `&text=${encodeURIComponent(query)}&boundary.country=ZA${focusParams}`;

    return this.http.get<any>(url).pipe(
      map(response =>
        (response.features || []).map((f: any) => ({
          label: f.properties.label,
          name: f.properties.name || f.properties.label,
          street: f.properties.street,
          city: f.properties.locality,
          zip: f.properties.postalcode || '',
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          isPoi: false
        } as AddressSuggestion))
      ),
      catchError(() => of([] as AddressSuggestion[]))
    );
  }

  /**
   * Geocode address string to coordinates (used for saved addresses without coords)
   */
  geocodeAddress(address: string): Observable<{ lat: number; lon: number }> {
    if (environment.mapboxToken) {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json` +
        `?access_token=${environment.mapboxToken}&country=za&limit=1`;
      return this.http.get<any>(url).pipe(
        map(res => {
          const f = res?.features?.[0];
          if (!f) throw new Error('No results');
          return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
        }),
        catchError(() => this.geocodeNominatim(address))
      );
    }
    return this.geocodeNominatim(address);
  }

  private geocodeNominatim(address: string): Observable<{ lat: number; lon: number }> {
    const cleaned = this.cleanAddress(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleaned)}`;
    return this.http.get<any[]>(url).pipe(
      switchMap(results => {
        if (results.length > 0) {
          return of({ lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) });
        }
        const fallback = cleaned.split(',').slice(0, 2).join(', ');
        return this.http.get<any[]>(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallback)}`
        ).pipe(
          map(r => {
            if (!r.length) throw new Error('No results');
            return { lat: parseFloat(r[0].lat), lon: parseFloat(r[0].lon) };
          })
        );
      })
    );
  }

  private cleanAddress(address: string): string {
    return address
      .split(',')
      .map(p => p.trim())
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .join(', ');
  }

  /**
   * Reverse geocode via Nominatim (used for GPS location)
   */
  reverseGeocode(lat: number, lon: number): Observable<any> {
    return this.http.get<any>(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
    );
  }

  /**
   * Reverse geocode via Mapbox — better postcode coverage for SA townships
   */
  reverseGeocodeMapbox(lat: number, lon: number): Observable<string> {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json` +
      `?types=postcode&access_token=${environment.mapboxToken}&country=za`;
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
    }, { headers: { 'Content-Type': 'application/json' } });
  }
}
