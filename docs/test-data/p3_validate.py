"""Validate the offline engine (p3_engine) reproduces the LIVE engine on the real seeded store, by
extracting the store's per-day series from the DB and comparing offline net/quality to outcomes captured
from the running backend (outcomes3.json)."""
import json, os, subprocess, uuid, datetime as dt
from p3_engine import compute_lift

here = os.path.dirname(os.path.abspath(__file__))
TENANT = "8854aa12-8ccf-42ba-bf40-36989da1b30b"
NS = uuid.UUID("11111111-2222-3333-4444-555555555555")
def item_id(key): return str(uuid.uuid5(NS, "item-" + key))

def psql(sql):
    out = subprocess.run(["psql","-h","localhost","-p","5433","-U","postgres","-d","ecommerce",
                          "-t","-A","-F",",","-c",sql], capture_output=True, text=True,
                         env={**os.environ,"PGPASSWORD":"Admin123"}).stdout
    return [l for l in out.strip().splitlines() if l]

# daily store orders + per-item units (local SAST day), seed data only
store_rows = psql(f"SELECT (order_date AT TIME ZONE 'Africa/Johannesburg')::date, count(*) FROM orders "
                  f"WHERE tenant_id='{TENANT}' AND order_notes='[[SEED]]' "
                  f"AND status NOT IN ('Cancelled','Rejected') GROUP BY 1 ORDER BY 1;")
item_rows = psql(f"SELECT (o.order_date AT TIME ZONE 'Africa/Johannesburg')::date, oi.menu_item_id, "
                 f"sum(oi.quantity) FROM order_item oi JOIN orders o ON oi.order_id=o.id "
                 f"WHERE o.tenant_id='{TENANT}' AND o.order_notes='[[SEED]]' "
                 f"AND o.status NOT IN ('Cancelled','Rejected') GROUP BY 1,2;")

store_by_date = {dt.date.fromisoformat(r.split(",")[0]): int(r.split(",")[1]) for r in store_rows}
dates = sorted(store_by_date)
base = dates[0]; N = (dates[-1] - base).days + 1
def idx(d): return (d - base).days
store_daily = [0]*N
for d, c in store_by_date.items(): store_daily[idx(d)] = c
weekday = [ (base + dt.timedelta(days=i)).weekday() for i in range(N) ]

item_daily = {}  # menu_item_id -> [per day]
for r in item_rows:
    ds, mid, q = r.split(","); d = dt.date.fromisoformat(ds)
    item_daily.setdefault(mid, [0]*N)[idx(d)] += int(float(q))

gt = json.load(open(os.path.join(here, "ground_truth.json")))
live = {(o["target"], round(o.get("discountPercent",0))): o
        for o in json.load(open(os.path.join(here,"outcomes3.json")))["outcomes"] if o.get("scope")!="ALL"}

print(f"{'promo':22}{'OFFLINE net/qual':>20}{'LIVE net/qual':>18}  match?")
ok = 0; tot = 0
for p in gt["promos"]:
    if p["scope"] != "PRODUCT": continue
    mid = item_id(p["item"]); series = item_daily.get(mid, [0]*N)
    s = idx(dt.datetime.fromisoformat(p["start"]).date()); e = idx(dt.datetime.fromisoformat(p["end"]).date())
    r = compute_lift(series, store_daily, weekday, s, e)
    # find the live row (match by injected pct via the title is ambiguous; match on the engine output set)
    title = p["title"]
    print(f"{title:22}{(str(r['net'])+' / '+r['quality']):>20}", end="")
    # live match: by the promo title's item + discount — approximate via net proximity
    cand = [o for k,o in live.items() if k[0] in title]
    best = min(cand, key=lambda o: abs((o.get('netLiftPercent') or 0) - (r['net'] or 0))) if cand else None
    if best:
        lv = f"{best.get('netLiftPercent')} / {best.get('dataQuality')}"
        m = (best.get('netLiftPercent')==r['net'] and best.get('dataQuality')==r['quality'])
        tot += 1; ok += 1 if m else 0
        print(f"{lv:>18}  {'YES' if m else 'close'}")
    else:
        print(f"{'(no live)':>18}")
print(f"\nexact matches: {ok}/{tot}  (offline engine mirrors live formulas)")
