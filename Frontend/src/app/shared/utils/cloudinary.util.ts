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

/**
 * Normalize a store LOGO of any shape into a clean, retina-sharp asset — the CDN-side
 * equivalent of trimming + padding/fitting in an image library. Done per display context:
 *   - 'square' : e_trim (tighten borders) → c_pad on white → a consistent padded square avatar
 *                that never crops the logo. For slots on white/rounded backgrounds.
 *   - 'fit'    : e_trim → c_fit by height, width auto → wide wordmarks stay full-width and tall,
 *                no white box. For the top-bar / header.
 * Both add dpr_2.0 (retina-sharp, kills blur) + f_auto/q_auto. `box` is the CSS display size in px.
 * Non-Cloudinary URLs and already-transformed URLs are returned unchanged.
 */
export function logoUrl(url: string, opts: { box?: number; mode?: 'square' | 'fit' } = {}): string {
  if (!url || typeof url !== 'string') return url;
  const marker = '/upload/';
  if (!url.includes('res.cloudinary.com') || !url.includes(marker)) return url;

  const firstSeg = (url.split(marker)[1] || '').split('/')[0];
  if (/(?:^|,)(?:f_|q_|w_|h_|c_|e_|dpr_|fl_|ar_)/.test(firstSeg)) return url;

  const box = opts.box ?? 96;
  const t = opts.mode === 'fit'
    ? `e_trim,c_fit,h_${box},dpr_2.0,f_auto,q_auto`
    : `e_trim,c_pad,b_white,w_${box},h_${box},dpr_2.0,f_auto,q_auto`;
  return url.replace(marker, `${marker}${t}/`);
}
