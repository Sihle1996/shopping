/**
 * Inserts Cloudinary delivery transformations into a Cloudinary image URL so the
 * CDN serves a small, modern-format image sized for where it's displayed:
 *   f_auto  — best format the browser supports (WebP/AVIF)
 *   q_auto  — automatic quality compression
 *   c_limit — downscale to the given width without upscaling or cropping
 *
 * Non-Cloudinary URLs (local assets, other hosts) and URLs that already carry a
 * transformation are returned unchanged.
 */
export function cloudinaryUrl(url: string, width: number = 400): string {
  if (!url || typeof url !== 'string') return url;
  const marker = '/upload/';
  if (!url.includes('res.cloudinary.com') || !url.includes(marker)) return url;

  // Skip if the first segment after /upload/ is already a transformation
  // (e.g. f_auto,q_auto,w_400) rather than a version or path segment.
  const firstSeg = (url.split(marker)[1] || '').split('/')[0];
  if (/(?:^|,)(?:f_|q_|w_|h_|c_|e_|dpr_|fl_|ar_)/.test(firstSeg)) return url;

  return url.replace(marker, `${marker}f_auto,q_auto,c_limit,w_${width}/`);
}
