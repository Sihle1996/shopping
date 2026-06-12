"""Offline re-implementation of the promo engine's PRODUCT net-lift + confidence. EMPIRICAL-VARIANCE
version: an 8-week baseline gives per-weekday mean AND observed variance, so uncertainty reflects real
dispersion (weekday/payday/slow-day volatility) instead of a Poisson theory + ×1.2 fudge. Poisson is kept
only as a floor for tiny samples. Mirrors AdminAiService.computeLift; shared by validation + the P3 sweep."""
import math, statistics

BASELINE_DAYS = 56     # ~8 of each weekday
SIGMA = 1.45            # confident gate (tuned on the sweep to hold ~7-8% false positives)

def _mean(x): return statistics.mean(x) if x else 0.0
def _var(x, m):        # sample variance, floored at the Poisson variance (= mean) for stability
    return max(statistics.variance(x), m) if len(x) >= 2 else m

def compute_lift(item_daily, store_daily, weekday, payday, s, e):
    blo = max(0, s - BASELINE_DAYS)
    idow = {w: [] for w in range(7)}; sdow = {w: [] for w in range(7)}
    itot = stot = 0
    for d in range(blo, s):
        if store_daily[d] <= 0: continue
        w = weekday[d]
        idow[w].append(item_daily[d]); sdow[w].append(store_daily[d])
        itot += item_daily[d]; stot += store_daily[d]
    iM = {w: _mean(idow[w]) for w in range(7)}; sM = {w: _mean(sdow[w]) for w in range(7)}
    iV = {w: _var(idow[w], iM[w]) for w in range(7)}; sV = {w: _var(sdow[w], sM[w]) for w in range(7)}

    iexp = sum(iM[weekday[d]] for d in range(s, e))
    sexp = sum(sM[weekday[d]] for d in range(s, e))
    # window-prediction variance: Σ per-weekday variance, inflated by (1+1/n) for the mean estimate
    ivar = sum(iV[weekday[d]] * (1 + 1/len(idow[weekday[d]]) if idow[weekday[d]] else 2.0) for d in range(s, e))
    svar = sum(sV[weekday[d]] * (1 + 1/len(sdow[weekday[d]]) if sdow[weekday[d]] else 2.0) for d in range(s, e))
    iact = sum(item_daily[s:e]); sact = sum(store_daily[s:e])

    ipct = round((iact-iexp)/iexp*100) if (itot >= 5 and iexp > 0) else None
    spct = round((sact-sexp)/sexp*100) if (stot >= 10 and sexp > 0) else None
    net = (ipct-spct) if (ipct is not None and spct is not None) else None
    netci = None
    if net is not None:
        ici = math.sqrt(ivar)/iexp*100; sci = math.sqrt(svar)/sexp*100
        netci = round(math.hypot(ici, sci))

    days = e-s
    signal = "MEASURED" if days >= 7 else ("MEASURING" if days >= 2 else "EARLY")
    if net is None or netci is None or abs(net) < SIGMA*netci:
        qual = "LOW"
    else:
        qual = "HIGH" if netci/abs(net) <= 0.5 else "MEDIUM"
    if signal == "MEASURING" and qual == "HIGH": qual = "MEDIUM"
    if signal == "EARLY": qual = "LOW"
    recorded = (net is not None and netci is not None and abs(net) >= SIGMA*netci)
    return {"net": net, "netci": netci, "quality": qual, "signal": signal, "recorded": recorded}
