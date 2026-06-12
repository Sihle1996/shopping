# Promo‑learning AI + Economics — Accuracy Test Report

**Date:** 2026‑06‑12 · **Store:** local tenant `8854aa12` (admin@test.com)

## ✅ Fixes applied (2026‑06‑12)
F1, F2, F4, F5, F6 were implemented in `AdminAiService.java` and **re‑verified against the same ground
truth** (`verify_fixes.py`):
- **F1/F5** — store‑wide `netRevenueLift` no longer double‑counts the discount and excludes platform‑funded
  delivery from the store's net: R10‑off **−R1608 → +R163** (= true), Free‑delivery **−R3027 → +R923** (= true).
  Added a `platformCost` field; `promoCost` is now the store‑funded discount only.
- **F2** — `dataQuality` is now a **1σ noise band** on the net lift, not raw volume: the flat promo drops from
  `HIGH` to `LOW` ("within noise"); the clean +40% winner reads `HIGH`; the +35%/−20% reads `MEDIUM`. New
  `netLiftCi` field exposes the ±band.
- **F4** — only the **earliest** promo in an overlapping same‑item cluster records an outcome (no double‑count).
- **F6/F2** — learning only records **clear signals** (outside the noise band), so flat/slow/short reads no
  longer pollute the priors. Result: the 3 real effects are learned; the 4 noise/overlap reads are dropped.
- **F3** (seasonality‑matched baseline) is **deferred** — bigger methodology change; left as the next step.

Verified via a faithful re‑implementation of the fixed formulas on the seeded data (compile‑clean; restart the
local backend to see it live in the UI).

---

**Status of the original test below:** validation that motivated the fixes (run before any engine change).

## How accuracy was measured
The engine just outputs numbers ("+23% net lift", "−R1519"). You can't judge a number without a known
true answer, so we **authored the truth**: a deterministic seed (`seed_promo_accuracy.py`, RNG=42) generated
**3,074 orders over 90 days** with **realistic non‑uniform demand** (Fri/Sat 2–3× a Monday, month‑end payday
bumps, ~10% slow days, Poisson noise) on a real SA takeaway menu (14 items, market prices), and ran **8
promotions whose true effect we injected** (e.g. "+35% on Beef Burger for 10 days"). We then ran the live
engine (`/promo-outcomes`, `/promo-economics`, `/suggest-promotions`) and scored its output against truth.
Reproduce: `python seed_promo_accuracy.py && psql … -f seed.sql`, then `python score_promo_accuracy.py`.
**You can see all of this now in the admin: Promos → Performance.**

## Headline accuracy
| Metric | Result |
|---|---|
| **Engine arithmetic** (does it compute its own formula correctly?) | **Correct** — MAE vs an independent recompute = **0.1 pp** |
| **Causal recovery** (does the number match the true effect?) | **MAE 11.3 pp**, **bias −8.7 pp** (systematically *under*‑states lift) |
| **Confidence calibration** (does `HIGH` quality mean accurate?) | **No** — `HIGH` was assigned to a **−12 pp** error and to a **flat promo read as −12%** |
| **Store‑wide R economics** | **Systematically wrong** — discount subtracted twice (see F1) |

### Per‑promo PRODUCT net‑lift
| Promo | Injected truth | Engine | Error | Signal | Quality | Verdict |
|---|---|---|---|---|---|---|
| Beef Burger 15% (busy, 10d) | **+35%** | +23% | −12 | MEASURED | HIGH | under‑states (store seasonality) |
| Cheese Burger 20% (loser) | **−20%** | −19% | +1 | MEASURED | HIGH | ✅ excellent |
| Chicken Wrap 10% (**flat**) | **0%** | **−12%** | −12 | MEASURED | **HIGH** | ❌ false negative at HIGH confidence |
| Veggie Wrap 25% (slow item) | **+30%** | −2% | −32 | MEASURED | MEDIUM | ❌ lift invisible in noise |
| Beef Burger Flash 12% (3d) | **+25%** | +11% | −14 | MEASURING | MEDIUM | short window noisy (correctly cautious) |
| Quarter Kota 20% (busy, 8d) | **+40%** | +40% | 0 | MEASURED | HIGH | ✅ perfect |
| Quarter Kota 15% (**overlap**) | 0% extra | +8% | — | MEASURING | MEDIUM | ❌ claims credit for the other promo |

**What's solid:** the math is exact; clear losers and high‑volume / long‑window winners recover well
(±0–1 pp); short windows are correctly flagged `MEASURING`.

---

## Findings (ranked by severity)

### F1 — Store‑wide `netRevenueLift` subtracts the discount TWICE  · **HIGH / real bug**
`order.total_amount` is stored **net of the discount** (`OrderService.java:249`,
`totalAmount = subtotal − discountAmount`). The economics then does
`netRevenueLift = (duringRevenue − expectedRevenue) − promoCost`. But `duringRevenue` is already net of the
discount, so the discount is removed once in the revenue and **again** as `promoCost`.
- *R10‑off promo:* true incremental = **+R252**; engine reported **−R1519** (double‑counted ~R1771).
- Every PERCENT_OFF / AMOUNT_OFF store‑wide promo is understated by ~its discount spend → **good promos look
  like losers.** This is the single biggest accuracy defect.

### F2 — `dataQuality` is volume‑based and does NOT reflect accuracy  · **HIGH (trust)**
`dataQuality` = HIGH/MEDIUM/LOW purely on units sold (`minVol ≥ 15 → HIGH`). But a high‑volume promo can
still be badly wrong: the **flat Chicken Wrap promo was reported −12% at `HIGH` confidence**, and Beef Burger
(true +35%) read +23% at `HIGH`. Volume ≠ reliability — the error comes from *confounding*, not sample size.
A store owner trusting "HIGH confidence" is being misled. There is no confidence interval on the lift.

### F3 — Net‑lift % is biased by within‑window store seasonality  · **MEDIUM**
`netLiftPercent = itemRate% − storeRate%` vs a flat **14‑day** baseline. When the store moves during the
promo window for item‑unrelated reasons (payday, weekends), `storeRate%` absorbs it and the subtraction
**mis‑credits the item** — here a **−8.7 pp average under‑statement**. The 14‑day baseline doesn't match the
promo window's day‑of‑week / payday composition.

### F4 — Overlapping promos double‑count in learning  · **MEDIUM (confirmed; was a known seam)**
Two concurrent Quarter‑Kota promos both measured the **same** elevated units (`productSales` ignores which
promo an order belongs to). The learning table recorded **two** outcomes for one real +40% event
(+40% and +8%) → the product's prior is diluted to 24% (or, summed, 48% of "credit" for a 40% lift).
`promo_outcome_record` has no overlap guard.

### F5 — FREE_DELIVERY charges a platform‑funded cost to the store  · **MEDIUM**
The free‑delivery promo's waived fees (R3950) are **platform‑funded** (`fundedBy=PLATFORM`, store cost R0 per
the promo‑economics model) yet are subtracted from the **store's** `netRevenueLift` (reported −R3027 vs a true
store‑side +R923). Platform cost shouldn't appear in the store's net.

### F6 — Low‑volume / short‑window promos are unreliable  · **LOW (mostly self‑flagged)**
Slow item (+30%→−2%) and 3‑day window (+25%→+11%) carry ±14–32 pp error. The `signal` correctly drops these
to `MEASURING`/`EARLY`, but the slow item still showed `MEASURED` — volume passed the gate while the estimate
was meaningless.

---

## Prioritised fix plan (to raise accuracy)
1. **Fix F1 (discount double‑count).** Either compute `incremental` on **gross** revenue (add the discount
   back into `duringRevenue` before differencing) **or** drop the `− promoCost` term (the net already
   reflects it). Pick one definition and label it. *Highest impact, smallest change.*
2. **Fix F5 (funding).** For `fundedBy=PLATFORM` promos, the store‑facing `netRevenueLift` should treat
   `promoCost = 0`; show the platform cost separately if at all.
3. **Recalibrate confidence (F2).** Make `dataQuality` reflect *estimate stability*, not raw volume — attach
   a **confidence interval** to net‑lift (e.g. from day‑level variance) and downgrade quality when the CI
   spans 0. A flat promo should read "no detectable effect", never "−12% (HIGH)".
4. **Reduce seasonality bias (F3).** Use a **matched / longer baseline** (same weekday composition, or
   day‑of‑week‑adjusted rates) instead of a flat 14‑day mean; consider a simple synthetic‑control on
   comparable non‑promoted items.
5. **Guard overlap (F4).** When recording outcomes (and measuring units), exclude windows where another
   promo overlapped the same product, or attribute units to a single promo. Stops corrupt priors.
6. **Tighten the low‑sample gate (F6).** Require a minimum *baseline* volume (not just total) before
   promoting a read to `MEASURED`.

These map onto the four seams in the `v54-hardening-prereqs` note; **F1 and F2 are new and should be done
before any ranking/learning leans harder on these numbers.**

## Reproduce / clean up
- Artifacts: `docs/test-data/{seed_promo_accuracy.py, seed.sql, ground_truth.json, score_promo_accuracy.py,
  outcomes.json, economics.json, suggestions.json, accuracy_results.json}`.
- Re‑run: `python seed_promo_accuracy.py && psql -h localhost -p 5433 -U postgres -d ecommerce -f seed.sql`.
- **Remove all synthetic data (restore the store):**
  ```sql
  DELETE FROM order_item WHERE order_id IN (SELECT id FROM orders WHERE order_notes='[[SEED]]');
  DELETE FROM orders WHERE order_notes='[[SEED]]';
  DELETE FROM promotions WHERE tenant_id='8854aa12-8ccf-42ba-bf40-36989da1b30b'
         AND id IN (<the 9 seeded promo ids>);   -- or by title prefix
  DELETE FROM menu_items WHERE id IN (<the 14 seeded item ids>);
  DELETE FROM promo_outcome_record WHERE tenant_id='8854aa12-8ccf-42ba-bf40-36989da1b30b';
  ```
