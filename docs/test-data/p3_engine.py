"""Offline re-implementation of the FIXED promo engine's PRODUCT net-lift + confidence (mirrors
AdminAiService.computeLift: F3 weekday-matched + payday-adjusted baseline, 1.2x over-dispersion CI,
1.5-sigma confident gate). Shared by validation (vs live) and the P3 calibration sweep."""
import math, statistics

CI_WIDEN = 1.2
SIGMA = 1.5

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

    # payday residual on top of the weekday profile (weekday-detrend, then split payday vs non-payday)
    iP=iN=sP=sN=0.0; iPn=iNn=sPn=sNn=0
    for d in range(blo, s):
        if store_daily[d] <= 0: continue
        w = weekday[d]; pay = payday[d]
        if savg[w] > 0:
            r = store_daily[d]/savg[w]
            if pay: sP+=r; sPn+=1
            else:   sN+=r; sNn+=1
        if iavg[w] > 0:
            r = item_daily[d]/iavg[w]
            if pay: iP+=r; iPn+=1
            else:   iN+=r; iNn+=1
    sPF = sP/sPn if sPn else 1.0; sNF = sN/sNn if sNn else 1.0
    iPF = iP/iPn if iPn else 1.0; iNF = iN/iNn if iNn else 1.0

    iexp = sum(iavg[weekday[d]]*(iPF if payday[d] else iNF) for d in range(s, e))
    sexp = sum(savg[weekday[d]]*(sPF if payday[d] else sNF) for d in range(s, e))
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
