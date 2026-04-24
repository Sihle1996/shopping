import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface FavouriteItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  available: boolean;
}

@Injectable({ providedIn: 'root' })
export class FavouriteService {
  private favouriteIds = new Set<string>();

  constructor(private http: HttpClient) {}

  load(): Observable<void> {
    return this.http.get<FavouriteItem[]>(`${environment.apiUrl}/api/favourites`).pipe(
      map(items => { this.favouriteIds = new Set(items.map(i => i.id)); })
    );
  }

  isFavourite(id: string): boolean {
    return this.favouriteIds.has(id);
  }

  toggle(id: string): Observable<boolean> {
    return this.http.post<{ favourited: boolean }>(`${environment.apiUrl}/api/favourites/${id}`, null).pipe(
      tap(res => {
        if (res.favourited) this.favouriteIds.add(id);
        else this.favouriteIds.delete(id);
      }),
      map(res => res.favourited)
    );
  }

  getAll(): Observable<FavouriteItem[]> {
    return this.http.get<FavouriteItem[]>(`${environment.apiUrl}/api/favourites`);
  }
}
