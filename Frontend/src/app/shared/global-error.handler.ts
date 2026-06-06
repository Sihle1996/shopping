import { ErrorHandler, Injectable } from '@angular/core';

/**
 * When a new version is deployed, an already-open tab still references the old
 * hashed lazy chunks. Requesting a chunk that no longer exists returns the SPA
 * index.html (HTML), producing a ChunkLoadError / "Failed to load module
 * script". Detect that and reload once so the tab picks up the fresh build.
 * A short sessionStorage guard prevents reload loops.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const message: string = (error && (error.message || error.toString())) || '';
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /Loading chunk \d+ failed/i.test(message) ||
      /Failed to (fetch dynamically imported module|load module script)/i.test(message) ||
      /error loading dynamically imported module/i.test(message);

    if (isChunkError) {
      const KEY = 'chunkReloadAt';
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 10000) {  // don't loop if a reload doesn't fix it
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
        return;
      }
    }

    console.error(error);
  }
}
