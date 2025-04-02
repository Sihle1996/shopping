import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  private orsApiKey = '5b3ce3597851110001cf62486eb46190526c4d34b70f6499f1ba52c2';

  constructor(private http: HttpClient) {}

  /**
   * Geocode full address to lat/lon using OpenStreetMap (Nominatim)
   */
  geocodeAddress(address: string): Observable<{ lat: number, lon: number }> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    return this.http.get<any[]>(url).pipe(
      map(results => {
        if (results.length === 0) {
          const fallbackAddress = address.split(',').slice(0, 2).join(',');
          throw new Error(`No results found for: ${address}. Fallback to: ${fallbackAddress}`);
        }
        return {
          lat: parseFloat(results[0].lat),
          lon: parseFloat(results[0].lon)
        };
      })
    );
  }

  /**
   * Fetch route coordinates from OpenRouteService (requires backend proxy to avoid CORS)
   */
  getRoute(start: [number, number], end: [number, number]): Observable<any> {
    // 🔁 Replace with your own backend if hitting CORS
    const url = `http://localhost:8080/api/map/route`;

    return this.http.post(url, {
      coordinates: [start, end]
    }, {
      headers: {
        'Content-Type': 'application/json'
        // ✅ Don't send Authorization if using frontend call (CORS blocked)
      }
    });
  }

  /**
   * Autocomplete address using OpenRouteService (✅ CORS-safe)
   */
  autocomplete(query: string): Observable<any[]> {
    const url = `https://api.openrouteservice.org/geocode/autocomplete?api_key=${this.orsApiKey}&text=${encodeURIComponent(query)}&boundary.country=ZA`;
  
    return this.http.get<any>(url).pipe(
      map(response => {
        return response.features.map((f: any) => ({
          label: f.properties.label,
          street: f.properties.street,
          city: f.properties.locality,
          zip: f.properties.postalcode || '', // fallback
          country: f.properties.country
        }));
      })
    );
  }
  
  
}
