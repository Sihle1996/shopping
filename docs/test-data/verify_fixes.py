#!/usr/bin/env python3
"""Faithfully re-implement the FIXED engine formulas on the seeded ground truth, to verify the fixes
without restarting the backend. Mirrors AdminAiService after F1/F2/F4/F5."""
import json, os, math, datetime as dt
here=os.path.dirname(os.path.abspath(__file__))
gt=json.load(open(os.path.join(here,"ground_truth.json")))
GTP={p["key"]:p for p in gt["promos"]}

def parse(s): return dt.datetime.fromisoformat(s)
# overlap clusters (F4): only the earliest same-item PRODUCT promo records
prod=[p for p in gt["promos"] if p["scope"]=="PRODUCT"]
def earlier_overlap(p):
    for q in prod:
        if q["key"]==p["key"] or q["item"]!=p["item"]: continue
        qs,qe,ps,pe=parse(q["start"]),parse(q["end"]),parse(p["start"]),parse(p["end"])
        if qs<pe and ps<qe and (qs<ps or (qs==ps and q["key"]<p["key"])): return True
    return False

print("=== F2/F4/F6 — PRODUCT confidence (noise band) + learning skip ===")
print(f"{'promo':5}{'inj%':>5}{'net%':>6}{'±noise':>8}{'NEW quality':>13}{'recorded?':>11}  reason")
for p in prod:
    net=p["expectedNetLiftPct"]
    bd,dd=p["baseDays"],p["durDays"]
    ibpd=p["baselineUnits"]/bd; sbpd=p["storeBaseCount"]/bd
    if net is None or ibpd<=0 or sbpd<=0:
        print(f"{p['key']:5}{p['injectedLiftPct']:>5}{'n/a':>6}{'':>8}{'LOW':>13}{'no':>11}  no baseline"); continue
    itemSe=math.hypot(math.sqrt(p["baselineUnits"])/bd, math.sqrt(p["duringUnits"])/dd)
    storeSe=math.hypot(math.sqrt(p["storeBaseCount"])/bd, math.sqrt(p["storeDurCount"])/dd)
    netCi=round(math.hypot(itemSe/ibpd*100, storeSe/sbpd*100))
    within=abs(net)<netCi
    qual="LOW" if within else ("HIGH" if netCi/abs(net)<=0.5 else "MEDIUM")
    # signal cap
    signal="MEASURED" if dd>=7 else "MEASURING"
    if signal=="MEASURING" and qual=="HIGH": qual="MEDIUM"
    ov=earlier_overlap(p)
    recorded = (not within) and (not ov)
    reason = "within noise" if within else ("earlier overlap" if ov else "clear signal")
    print(f"{p['key']:5}{p['injectedLiftPct']:>5}{net:>6}{('±'+str(netCi)):>8}{qual:>13}{('YES' if recorded else 'no'):>11}  {reason}")

print("\n=== F1/F5 — ALL-scope net revenue lift (no double-count; platform cost excluded) ===")
print(f"{'promo':5}{'OLD net':>9}{'NEW net':>9}{'true':>8}  detail")
for p in [x for x in gt["promos"] if x["scope"]=="ALL"]:
    during=p["duringRevenue"]; expected=p["expectedRevenue"]; cost=p["promoCost"]
    # OLD: incremental - totalCost ; NEW: during - expected (store net); discount already netted
    old_net=p["expectedNetRevenueLift"]          # = (during-expected) - totalCost  (the bug)
    new_net=during-expected                       # store's true net
    # p6 is a discount promo (cost=discount); p7 is free delivery (cost=platform delivery)
    print(f"{p['key']:5}{('R'+str(old_net)):>9}{('R'+str(round(new_net))):>9}{('R'+str(during-expected)):>8}  during R{during} - expected R{expected} (cost R{round(cost)} no longer double-subtracted)")
