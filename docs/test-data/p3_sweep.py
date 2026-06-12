"""P3 — multi-store calibration sweep. Simulates several store TYPES, runs many promos with KNOWN
injected lift through the offline (live-validated) fixed engine, and reports the metric that matters:
does confidence track accuracy? Plus a false-positive test on a store where every promo truly does
nothing. Deterministic (fixed seeds)."""
import random, math, statistics, datetime as dt
from collections import defaultdict
from p3_engine import compute_lift
from p3_engine import SIGMA as SIGMA_GATE

DAYS = 170
BASE_DATE = dt.date(2025, 1, 6)  # a Monday
weekday = [ (BASE_DATE + dt.timedelta(days=i)).weekday() for i in range(DAYS) ]
payday_flag = [ ((BASE_DATE+dt.timedelta(days=i)).day >= 25 or (BASE_DATE+dt.timedelta(days=i)).day <= 2) for i in range(DAYS) ]
def payday(i):
    return 1.30 if payday_flag[i] else 1.0

# store TYPES: (orders/day, weekday weights Mon..Sun, n_items, item base-rate range)
PROFILES = {
  "fast-food":   dict(base=40, dow=[0.8,0.8,0.9,1.0,1.6,2.2,1.4], items=14, rate=(2,12)),
  "pizza":       dict(base=25, dow=[0.7,0.7,0.8,1.0,1.8,2.1,1.7], items=10, rate=(2,10)),
  "coffee":      dict(base=60, dow=[1.25,1.25,1.2,1.2,1.15,0.6,0.45], items=8, rate=(4,16)),  # weekday peak
  "low-volume":  dict(base=8,  dow=[0.9,0.9,0.95,1.0,1.4,1.7,1.2], items=10, rate=(0.4,2.5)),
  "high-volume": dict(base=80, dow=[0.85,0.85,0.9,1.0,1.5,2.0,1.4], items=16, rate=(3,14)),
  "null(0%)":    dict(base=25, dow=[0.8,0.8,0.9,1.0,1.6,2.2,1.4], items=12, rate=(2,10), null=True),
}
LIFTS = [-30,-20,-10,0,0,10,15,20,30,40,50]   # true effects to test (incl. zeros)
PROMOS_PER_STORE = 45
SEEDS = [1,2,3]

def gen_store(rng, prof):
    store = [0.0]*DAYS
    items = []
    for _ in range(prof["items"]):
        base = rng.uniform(*prof["rate"])
        tilt = [d * rng.lognormvariate(0, 0.18) for d in prof["dow"]]   # item's OWN weekday pattern
        items.append({"base": base, "dow": tilt, "series": [0]*DAYS})
    for d in range(DAYS):
        f = prof["dow"][weekday[d]] * payday(d)
        store[d] = max(0, rng.gauss(prof["base"]*f, prof["base"]*0.12))
        for it in items:
            mu = it["base"] * it["dow"][weekday[d]] * payday(d)
            it["series"][d] = rng_poisson(rng, max(0.01, mu))
    store = [rng_poisson(rng, s) for s in store]
    return store, items

def rng_poisson(rng, lam):
    # Knuth
    L = math.exp(-lam); k = 0; p = 1.0
    while True:
        k += 1; p *= rng.random()
        if p <= L: return k-1

rows = []   # dict per measurement
for stype, prof in PROFILES.items():
    for seed in SEEDS:
        rng = random.Random(f"{stype}-{seed}")   # string seed = deterministic (Python hash() is randomized)
        store, items = gen_store(rng, prof)
        for _ in range(PROMOS_PER_STORE):
            it = rng.choice(items)
            L = 0.0 if prof.get("null") else rng.choice(LIFTS)/100.0
            wlen = rng.randint(7, 10)
            s = rng.randint(60, DAYS-wlen-1); e = s+wlen
            st = [x for x in store]; ser = [x for x in it["series"]]
            for d in range(s, e):
                new = round(ser[d]*(1+L)); st[d] += (new - ser[d]); ser[d] = new
            r = compute_lift(ser, st, weekday, payday_flag, s, e)
            rows.append(dict(store=stype, true=round(L*100), net=r["net"], netci=r["netci"],
                             quality=r["quality"], recorded=r["recorded"]))

usable=[r for r in rows if r["net"] is not None]
print("="*70)
print(f"P3 — multi-store calibration sweep  ({len(rows)} promos, {len(usable)} with a usable read)")
print("="*70)

print("\n### Bias by store type (F3 check — should be near 0)")
print(f"{'store type':14}{'n':>5}{'MAE':>8}{'bias':>8}  confidence mix")
for stype in PROFILES:
    rs=[r for r in usable if r["store"]==stype]
    if not rs: continue
    m=sum(abs(r["net"]-r["true"]) for r in rs)/len(rs); b=sum(r["net"]-r["true"] for r in rs)/len(rs)
    mix={q:sum(1 for r in rs if r["quality"]==q) for q in ("HIGH","MEDIUM","LOW")}
    print(f"{stype:14}{len(rs):>5}{m:>8.1f}{b:>+8.1f}  H{mix['HIGH']} M{mix['MEDIUM']} L{mix['LOW']}")

print("\n### CALIBRATION — COVERAGE: does truth fall within the stated ±band? (target ~68% for 1σ)")
print(f"{'confidence':12}{'n':>6}{'coverage':>10}{'sign-correct':>14}   (sign excludes true=0)")
for q in ["HIGH","MEDIUM","LOW"]:
    rs=[r for r in usable if r["quality"]==q]
    if not rs: continue
    cov=sum(1 for r in rs if abs(r["net"]-r["true"])<=r["netci"])/len(rs)
    nz=[r for r in rs if r["true"]!=0]
    sgn=sum(1 for r in nz if (r["net"]>0)==(r["true"]>0))/len(nz) if nz else float('nan')
    print(f"{q:12}{len(rs):>6}{100*cov:>9.0f}%{100*sgn:>13.0f}%")

print("\n### FALSE POSITIVES vs gate strictness (true effect = 0%)")
zero=[r for r in usable if r["true"]==0]
nz=[r for r in usable if r["true"]!=0]
print(f"  {len(zero)} zero-effect promos, {len(nz)} real-effect promos")
print(f"  {'gate':>6}{'FP rate (0% called confident)':>32}{'recall (real effect caught)':>30}")
for k in (1.0, 1.5, 2.0):
    fp=sum(1 for r in zero if r["netci"] and abs(r["net"])>=k*r["netci"])/len(zero)
    rc=sum(1 for r in nz   if r["netci"] and abs(r["net"])>=k*r["netci"])/len(nz)
    tag=" <- current (1σ)" if k==1.0 else ""
    print(f"  {k:>5.1f}σ{100*fp:>28.0f}%{100*rc:>29.0f}%{tag}")

print("\n### Learning hygiene")
rec=[r for r in usable if r["recorded"]]; recz=[r for r in rec if r["true"]==0]
print(f"  recorded (clear signal, 1σ): {len(rec)}/{len(usable)} ({100*len(rec)/len(usable):.0f}%); "
      f"of those zero-effect (noise learned): {100*len(recz)/max(1,len(rec)):.0f}%")

# ── REGRESSION GATE — codifies the calibration baseline; any future Vision change must pass these ──
print("\n### REGRESSION GATE (run after any change to the promo engine)")
def chk(name, ok, val, thr):
    print(f"  [{'PASS' if ok else 'FAIL'}] {name:30}{val:>8}   target {thr}"); return ok
high=[r for r in usable if r['quality']=='HIGH']; med=[r for r in usable if r['quality']=='MEDIUM']
hnz=[r for r in high if r['true']!=0]
hsign=100*sum(1 for r in hnz if (r['net']>0)==(r['true']>0))/max(1,len(hnz))
zero=[r for r in usable if r['true']==0]
fp=100*sum(1 for r in zero if r['netci'] and abs(r['net'])>=SIGMA_GATE*r['netci'])/max(1,len(zero))
obias=sum(r['net']-r['true'] for r in usable)/len(usable)
worst=max(abs(sum(r['net']-r['true'] for r in usable if r['store']==s)/max(1,sum(1 for r in usable if r['store']==s))) for s in PROFILES)
covH=100*sum(1 for r in high if abs(r['net']-r['true'])<=r['netci'])/max(1,len(high))
covM=100*sum(1 for r in med  if abs(r['net']-r['true'])<=r['netci'])/max(1,len(med))
ok=True
ok&=chk('HIGH sign-correct >= 95%', hsign>=95, f'{hsign:.0f}%','>=95%')
ok&=chk('false positives <= 10%', fp<=10, f'{fp:.0f}%','<=10%')
ok&=chk('overall |bias| <= 3pp', abs(obias)<=3, f'{obias:+.1f}','<=3pp')
ok&=chk('worst-store |bias| <= 7pp', worst<=7, f'{worst:.1f}','<=7pp')
ok&=chk('HIGH coverage in [60,80]%', 60<=covH<=80, f'{covH:.0f}%','60-80%')
ok&=chk('MEDIUM coverage in [60,80]%', 60<=covM<=80, f'{covM:.0f}%','60-80%')
print(f"\n  ===> {'PASS - calibration baseline held' if ok else 'FAIL - regression vs baseline'} <===")
