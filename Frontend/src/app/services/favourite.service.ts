import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface FavouriteItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  available: boolean;
  soldOut: boolean;        // computed server-side: no free stock after reservations
  availableStock: number;  // computed server-side: what's sellable now
}

@Injectable({ providedIn: 'root' })
export class FavouriteService {
  private favouriteIds = new Set<string>();
  private readonly GUEST_KEY = 'guest_favourites';

  constructor(private http: HttpClient) {
    // Seed guest favourites from localStorage so hearts render correctly before any load() call.
    if (!localStorage.getItem('token')) this.favouriteIds = new Set(this.getGuestFavs());
  }

  private getGuestFavs(): string[] {
    try { return JSON.parse(localStorage.getItem(this.GUEST_KEY) || '[]'); } catch { return []; }
  }
  private saveGuestFavs(ids: string[]): void {
    localStorage.setItem(this.GUEST_KEY, JSON.stringify(ids));
  }

  load(): Observable<void> {
    // Guests have no server favourites — show the ones they saved locally instead of a 403.
    if (!localStorage.getItem('token')) {
      this.favouriteIds = new Set(this.getGuestFavs());
      return of(void 0);
    }
    return this.http.get<FavouriteItem[]>(`${environment.apiUrl}/api/favourites`).pipe(
      map(items => { this.favouriteIds = new Set(items.map(i => i.id)); })
    );
  }

  isFavourite(id: string): boolean {
    return this.favouriteIds.has(id);
  }

  toggle(id: string): Observable<boolean> {
    // Guests: store the favourite locally and replay it after login, so they continue where they left off.
    if (!localStorage.getItem('token')) {
      const favs = this.getGuestFavs();
      const i = favs.indexOf(id);
      let nowFav: boolean;
      if (i >= 0) { favs.splice(i, 1); this.favouriteIds.delete(id); nowFav = false; }
      else { favs.push(id); this.favouriteIds.add(id); nowFav = true; }
      this.saveGuestFavs(favs);
      return of(nowFav);
    }
    return this.http.post<{ favourited: boolean }>(`${environment.apiUrl}/api/favourites/${id}`, null).pipe(
      tap(res => {
        if (res.favourited) this.favouriteIds.add(id);
        else this.favouriteIds.delete(id);
      }),
      map(res => res.favourited)
    );
  }

  /** Replay favourites a guest saved before logging in, then clear the local copy. */
  mergePendingFavourites(): Observable<void> {
    const favs = this.getGuestFavs();
    if (!favs.length) return of(void 0);
    const reqs = favs.map(id => this.http.post(`${environment.apiUrl}/api/favourites/${id}`, null));
    return forkJoin(reqs).pipe(
      tap({ next: () => localStorage.removeItem(this.GUEST_KEY), error: () => {} }),
      map(() => void 0)
    );
  }

  getAll(): Observable<FavouriteItem[]> {
    return this.http.get<FavouriteItem[]>(`${environment.apiUrl}/api/favourites`);
  }
}
