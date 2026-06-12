"""Offline re-implementation of the FIXED promo engine's PRODUCT net-lift + confidence (mirrors
AdminAiService.computeLift after F1-F6, incl. the F3 day-of-week-matched baseline). Shared by the
validation (vs the live engine on the real store) and the P3 multi-store calibration sweep."""
import math, statistics

def compute_lift(item_daily, store_daily, weekday, s, e):
    """item_daily/store_daily: per-day counts; weekday[d] in 0..6; window = day indices [s,e)."""
    blo = max(0, s - 28)                                   # 28-day baseline
    idow = {w: [] for w in range(7)}; sdow = {w: [] for w in range(7)}
    itot = stot = 0
    for d in range(blo, s):
        if store_daily[d] <= 0:                            # skip pre-data / closed days
            continue
        w = weekday[d]
        idow[w].append(item_daily[d]); sdow[w].append(store_daily[d])
        itot += item_daily[d]; stot += store_daily[d]
    iavg = {w: (statistics.mean(idow[w]) if idow[w] else 0.0) for w in range(7)}
    savg = {w: (statistics.mean(sdow[w]) if sdow[w] else 0.0) for w in range(7)}
    iexp = sum(iavg[weekday[d]] for d in range(s, e))      # day-of-week-matched expectation
    sexp = sum(savg[weekday[d]] for d in range(s, e))
    iact = sum(item_daily[s:e]); sact = sum(store_daily[s:e])
    ipct = round((iact - iexp) / iexp * 100) if (itot >= 5 and iexp > 0) else None
    spct = round((sact - sexp) / sexp * 100) if (stot >= 10 and sexp > 0) else None
    net = (ipct - spct) if (ipct is not None and spct is not None) else None
    netci = None
    if net is not None:
        ici = math.sqrt(iact + iexp) / iexp * 100
        sci = math.sqrt(sact + sexp) / sexp * 100
        netci = round(math.hypot(ici, sci))
    days = e - s
    signal = "MEASURED" if days >= 7 else ("MEASURING" if days >= 2 else "EARLY")
    SIGMA = 1.5   # confident floor (matches CONFIDENT_SIGMA in AdminAiService)
    if net is None or netci is None or abs(net) < SIGMA * netci:
        qual = "LOW"
    else:
        qual = "HIGH" if netci / abs(net) <= 0.5 else "MEDIUM"
    if signal == "MEASURING" and qual == "HIGH":
        qual = "MEDIUM"
    if signal == "EARLY":
        qual = "LOW"
    # learning records only a clear signal (>= the confident floor)
    recorded = (net is not None and netci is not None and abs(net) >= SIGMA * netci)
    return {"net": net, "netci": netci, "quality": qual, "signal": signal, "recorded": recorded}
