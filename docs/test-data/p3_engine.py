"""Offline re-implementation of the FIXED promo engine's PRODUCT net-lift + confidence (mirrors
AdminAiService.computeLift: F3 weekday-matched baseline, 1.2x over-dispersion CI, 1.3-sigma confident
gate). Shared by validation (vs live) and the P3 calibration sweep."""
import math, statistics

CI_WIDEN = 1.2
SIGMA = 1.3

def compute_lift(item_daily, store_daily, weekday, payday, s, e):
    blo = max(0, s - 28)
    idow = {w: [] for w in range(7)}; sdow = {w: [] for w in range(7)}
    itot = stot = 0
    for d in range(blo, s):
        if store_daily[d] <= 0: continue
        w = weekday[d]
        idow[w].append(item_daily[d]); sdow[w].append(store_daily[d])
        itot += item_daily[d]; stot += store_daily[d]
    iavg = {w: (statistics.mean(idow[w]) if idow[w] else 0.0) for w in range(7)}
    savg = {w: (statistics.mean(sdow[w]) if sdow[w] else 0.0) for w in range(7)}

    # weekday-matched expectation (payday residual tested + reverted — over-corrects from sparse samples)
    iexp = sum(iavg[weekday[d]] for d in range(s, e))
    sexp = sum(savg[weekday[d]] for d in range(s, e))
    iact = sum(item_daily[s:e]); sact = sum(store_daily[s:e])

    ipct = round((iact-iexp)/iexp*100) if (itot >= 5 and iexp > 0) else None
    spct = round((sact-sexp)/sexp*100) if (stot >= 10 and sexp > 0) else None
    net = (ipct-spct) if (ipct is not None and spct is not None) else None
    netci = None
    if net is not None:
        ici = math.sqrt(iact+iexp)/iexp*100; sci = math.sqrt(sact+sexp)/sexp*100
        netci = round(math.hypot(ici, sci)*CI_WIDEN)

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
