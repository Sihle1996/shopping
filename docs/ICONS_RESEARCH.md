# CraveIt icon system — research & recommendation

**Scope:** the Angular customer + store-admin app (`Frontend/`) — nav sidebar, mobile footer,
buttons, badges, empty states, everywhere. **Out of scope:** the SuperAdmin React app, which keeps
its `lucide-react` icons.

## 1. Where we are today

- **Library:** Bootstrap Icons `1.11.3`, loaded as a web-font via CDN in `index.html`
  (`<i class="bi bi-...">`).
- **Footprint:** **175 distinct icons, 626 usages** across the app.
- **Nav sidebar / mobile footer** both use it: `bi-grid` (Dashboard), `bi-receipt` (Orders),
  `bi-journal-text` (Menu), `bi-box-seam` (Inventory), `bi-truck` (Drivers), `bi-tag` (Promos),
  `bi-star` (Reviews), `bi-wallet2` (Payouts), `bi-gear` (Settings), etc.
- We already have a **bespoke brand glyph**: `app-brand-mark` (the bitten‑V) used for empty states
  and the AI "thinking" states — that stays; it's our signature.

**Why it feels generic:** Bootstrap Icons is one of the most widely used free sets, has a single
weight, and mixes corner radii. Nothing wrong with it functionally — it just reads as "default,"
and the nav/footer (the most-seen surfaces) carry that default feel.

## 2. What "unique" actually means for icons

Uniqueness rarely comes from a never-before-seen icon set — it comes from a **consistent system**:

1. **One family, one default weight** across the whole app (no mixing).
2. **Line (inactive) → Fill/Duotone (active)** for nav + footer — this pairs perfectly with our
   existing brand-colour active state (the inset accent pill). That state change is what makes a
   nav feel crafted.
3. **A few bespoke brand glyphs** for hero moments (we have the bitten‑V; we can add 2–3 more —
   e.g. a "crave" flame, the delivery moment).
4. **A tight sizing scale** (16 / 18 / 20 / 24) and consistent stroke.

So the recommendation is: **pick one expressive family that ships line + fill weights**, apply the
line→fill nav pattern, and keep the bitten‑V for signature moments.

## 3. Options considered

| Set | Style / character | Weights (line→fill) | Count | License | Angular fit | Unique? |
|---|---|---|---|---|---|---|
| **Phosphor** ⭐ | friendly, geometric-rounded | thin·light·regular·bold·**fill**·**duotone** (6) | ~1,500 | MIT | `@phosphor-icons/web` web-font → `<i class="ph ph-x">` (drop-in for `bi`) | High |
| **Solar** | modern, trendy, rounded | linear·**bold**·**duotone**·broken | ~1,200 | CC/MIT (Figma-origin) | SVG (Iconify) | High |
| **Iconsax** | distinctive, recognizable | linear·outline·**bold**·**bulk**·twotone·broken (6) | ~1,000 | free | SVG (Iconify) | High |
| **Hugeicons** | broad, distinctive | stroke·**solid**·**duotone**·twotone·bulk | 4,000+ free | free core | SVG (Iconify) | High |
| **Remix Icon** | neutral, clean | **line + fill pairs** | ~2,800 | Apache | web-font / SVG | Medium |
| **Tabler** | clean, consistent 24px | outline·**filled** | ~5,200 | MIT | web-font / SVG | Medium (Feather-ish) |
| **Lucide** | clean, minimal | single (outline) | ~1,500 | ISC | easy | **Low** — very common, and SuperAdmin already uses it |
| Bootstrap (today) | mixed | single + some fills | ~2,000 | MIT | current | Low |

Notes:
- **Lucide** is deliberately *not* recommended for the unique goal: it's everywhere, single-weight,
  and is already the SuperAdmin's set — using it here would read as more "default," not less.
- **Iconify** (`@iconify/...`) can serve Solar/Iconsax/Hugeicons on demand if we go SVG, but adds a
  build/runtime dependency. For a low-friction swap, a **web-font set (Phosphor)** is closest to our
  current `<i class="bi …">` pattern.

## 4. Recommendation

**Primary: Phosphor Icons** (default weight **regular**, **fill** for active nav/footer, **duotone**
reserved for a few feature accents).

Why Phosphor for CraveIt specifically:
- **Warm, rounded, friendly geometry** — matches a consumer food brand and our bitten‑V mark far
  better than the squared/technical sets.
- **6 weights from one family** → the line→fill active-state system is built-in and effortless.
- **`fork-knife`, `cooking-pot`, `hamburger`, `coffee`, `storefront`, `moped`** etc. let us use
  *on-brand* glyphs (e.g. Menu = a fork-knife, not a generic journal) — small touches that make the
  app feel made-for-food.
- **MIT**, and the `@phosphor-icons/web` font means migration is largely a **class swap**
  (`bi bi-x` → `ph ph-y`), not a re-architecture.

**Bolder alternative: Solar** (linear default + **duotone** active). More "2024 premium dashboard"
and more distinctive than Phosphor, at the cost of an Iconify/SVG integration (no drop-in web-font)
and a slightly less food-friendly tone. Pick Solar if the goal leans "striking/trendy" over
"friendly/approachable."

## 5. The system (what we'd actually apply)

- **Nav sidebar + mobile footer:** `ph` (regular) when inactive → `ph-fill` when active, alongside
  the brand-colour pill we already have. This is the single highest-impact change for "unique."
- **On-brand nav glyphs:** Dashboard `squares-four`, Orders `receipt`, **Menu `fork-knife`**,
  Inventory `package`, Drivers `moped`/`truck`, Promos `tag`/`seal-percent`, Reviews `star`,
  Payouts `wallet`, Books `notebook`, Plan `credit-card`, Users `users`, Settings `gear-six`,
  Support `headset`, Activity `clock-counter-clockwise`.
- **Bespoke glyphs:** keep `app-brand-mark` (bitten‑V) for empty/loading/AI; optionally add a
  custom "crave flame" for promos/hero and a delivery mark.
- **Sizing scale:** 16 (inline) / 18 (nav) / 20 (buttons) / 24 (headers).

## 6. Migration plan (phased, ~mechanical)

1. **Add Phosphor** (`@phosphor-icons/web`), keep Bootstrap Icons in parallel during migration.
2. **Phase 1 — identity surfaces (highest value, ~30 icons):** sidebar nav, mobile footer, top
   navbar, primary buttons. Apply the line→fill active pattern. This alone delivers the "unique"
   feel. Starter mapping for the nav/footer set:
   | Bootstrap | Phosphor |
   |---|---|
   | `bi-grid` | `ph-squares-four` |
   | `bi-receipt` | `ph-receipt` |
   | `bi-journal-text` | `ph-fork-knife` (Menu — on-brand) |
   | `bi-box-seam` | `ph-package` |
   | `bi-truck` | `ph-truck` / `ph-moped` |
   | `bi-tag` | `ph-tag` / `ph-seal-percent` |
   | `bi-star` | `ph-star` |
   | `bi-wallet2` | `ph-wallet` |
   | `bi-journal-bookmark` | `ph-notebook` |
   | `bi-credit-card-2-front` | `ph-credit-card` |
   | `bi-people` | `ph-users` |
   | `bi-gear` | `ph-gear-six` |
   | `bi-headset` | `ph-headset` |
   | `bi-clock-history` | `ph-clock-counter-clockwise` |
3. **Phase 2 — the long tail (~145 icons):** a `bi → ph` mapping table + find/replace across
   templates. The classes are 1:1 (`<i class="bi bi-x">` → `<i class="ph ph-y">`), so it's
   mechanical; the work is choosing the right Phosphor name per icon.
4. **Phase 3 — cleanup:** remove the Bootstrap Icons CDN link + dependency once usages hit zero.
5. **Bespoke glyphs:** design 2–3 custom marks for hero moments.

**Effort:** Phase 1 is small and high-impact (a day-ish, fully verifiable via screenshots). Phases
2–3 are larger but purely mechanical and can be done incrementally without breaking anything (both
sets coexist during migration).

## 7. Decision needed

- **Family:** Phosphor (recommended, friendly + drop-in) vs Solar (bolder/trendier, more work)?
- **Scope to start:** Phase 1 only (nav + footer + buttons — the identity surfaces) vs full app?
- **Bespoke glyphs:** do we want 2–3 custom brand icons designed, or icon-set only for now?
