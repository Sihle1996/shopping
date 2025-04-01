import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GeocodingService {
  constructor(private http: HttpClient) {}

  geocodeAddress(address: string): Observable<{ lat: number, lon: number }> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    return this.http.get<any[]>(url).pipe(
      map(results => {
        if (results.length === 0) {
          // 👇 fallback attempt with simpler query (like city only)
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
  

  getRoute(start: [number, number], end: [number, number]): Observable<any> {
    const token = '5b3ce3597851110001cf62486eb46190526c4d34b70f6499f1ba52c2'; // ✅ Your ORS API key
    const url = `https://api.openrouteservice.org/v2/directions/driving-car`;

    return this.http.post(url, {
      coordinates: [start, end]
    }, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });
  }
}
