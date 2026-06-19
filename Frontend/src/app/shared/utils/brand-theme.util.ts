// Single source of truth for applying a store's storefront theme (colour, accent, font, button
// style) to the document at runtime via CSS custom properties. Used by the store page (apply on
// load), app.component (restore on reload), and navbar (reset when leaving a store). Keeping it in
// one place stops the storefront font/colour from leaking into the CraveIt store list.

export interface BrandTheme {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  brandFont?: string | null;
  buttonStyle?: string | null;   // "rounded" | "pill" | "square"
  buttonFill?: string | null;    // "solid" | "outline"
}

const CRAVEIT = { primary: '#E76F51', secondary: '#264653', hover: '#C15A35' };

// Google-Fonts family params for the curated fonts (must match admin-settings brandFonts keys).
const FONT_FAMILIES: Record<string, string> = {
  poppins: 'Poppins:wght@400;500;600;700',
  montserrat: 'Montserrat:wght@400;600;700',
  inter: 'Inter:wght@400;500;600',
  playfair: 'Playfair+Display:wght@500;600;700',
  lora: 'Lora:wght@400;500;600',
  oswald: 'Oswald:wght@400;500;600',
  nunito: 'Nunito:wght@400;600;700',
};
const FONT_STACKS: Record<string, string> = {
  poppins: "'Poppins', sans-serif",
  montserrat: "'Montserrat', sans-serif",
  inter: "'Inter', sans-serif",
  playfair: "'Playfair Display', serif",
  lora: "'Lora', serif",
  oswald: "'Oswald', sans-serif",
  nunito: "'Nunito', sans-serif",
};

function fontStack(key?: string | null): string {
  return (key && FONT_STACKS[key]) || 'var(--font-heading)';
}

function loadFont(key?: string | null): void {
  if (!key || !FONT_FAMILIES[key]) return;
  let link = document.getElementById('brand-font-store') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = 'brand-font-store';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = `https://fonts.googleapis.com/css2?family=${FONT_FAMILIES[key]}&display=swap`;
}

function darken(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
  const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(2.55 * percent));
  const b = Math.max(0, (num & 0x0000ff) - Math.round(2.55 * percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Apply a store's theme to the document + persist it for reload restoration. */
export function applyStoreBranding(t: BrandTheme): void {
  const root = document.documentElement;
  const primary = t.primaryColor || CRAVEIT.primary;
  const secondary = t.secondaryColor || CRAVEIT.secondary;
  const fill = t.buttonFill || 'solid';
  const radius = t.buttonStyle === 'pill' ? '9999px' : t.buttonStyle === 'square' ? '0' : '0.75rem';

  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-primary-light', primary + '1A');
  root.style.setProperty('--brand-primary-hover', darken(primary, 15));
  root.style.setProperty('--brand-secondary', secondary);
  root.style.setProperty('--brand-font', fontStack(t.brandFont));
  root.style.setProperty('--btn-radius', radius);
  if (fill === 'outline') {
    root.style.setProperty('--cta-bg', 'transparent');
    root.style.setProperty('--cta-color', primary);
    root.style.setProperty('--cta-border', primary);
  } else {
    root.style.setProperty('--cta-bg', primary);
    root.style.setProperty('--cta-color', '#ffffff');
    root.style.setProperty('--cta-border', 'transparent');
  }
  loadFont(t.brandFont);

  localStorage.setItem('brandPrimary', primary);
  localStorage.setItem('brandTheme', JSON.stringify({
    secondaryColor: secondary, brandFont: t.brandFont || '',
    buttonStyle: t.buttonStyle || 'rounded', buttonFill: fill,
  }));
}

/** Re-apply the persisted store theme (called on a /store/ reload). */
export function restoreStoreBranding(): void {
  const primary = localStorage.getItem('brandPrimary');
  if (!primary) return;
  let theme: any = {};
  try { theme = JSON.parse(localStorage.getItem('brandTheme') || '{}'); } catch { /* ignore */ }
  applyStoreBranding({ primaryColor: primary, ...theme });
}

/** Revert to the CraveIt default theme + drop the injected store font (leaving a store). */
export function resetStoreBranding(): void {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', CRAVEIT.primary);
  root.style.setProperty('--brand-primary-light', CRAVEIT.primary + '1A');
  root.style.setProperty('--brand-primary-hover', CRAVEIT.hover);
  root.style.setProperty('--brand-secondary', CRAVEIT.secondary);
  root.style.setProperty('--brand-font', 'var(--font-heading)');
  root.style.setProperty('--btn-radius', '0.75rem');
  root.style.setProperty('--cta-bg', CRAVEIT.primary);
  root.style.setProperty('--cta-color', '#ffffff');
  root.style.setProperty('--cta-border', 'transparent');
  document.getElementById('brand-font-store')?.remove();
  localStorage.removeItem('brandTheme');
}
