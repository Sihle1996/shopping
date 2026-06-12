#!/usr/bin/env python3
"""
Seed a realistic 3-month order history with KNOWN injected promo effects, into the local store
(tenant 8854aa12), to measure how accurately the promo-learning + economics engine recovers truth.

Deterministic (fixed RNG). Emits:
  - seed.sql           : DELETE prior seed + INSERT menu, Drinks category, 8 promos, orders, order_items
  - ground_truth.json  : per-promo injected truth + realized before/during units in the ENGINE's windows

Every seeded order carries order_notes='[[SEED]]' so the whole dataset is removable in one query.
Run:  python seed_promo_accuracy.py  &&  psql ... -f seed.sql
"""
import json, random, uuid, datetime as dt, os

TENANT = "8854aa12-8ccf-42ba-bf40-36989da1b30b"
USER   = "d8a4918e-fa01-4c7d-bca6-32482149e750"   # customer@test.com
SEEDTAG = "[[SEED]]"
NS = uuid.UUID("11111111-2222-3333-4444-555555555555")
rng = random.Random(42)
def uid(label): return str(uuid.uuid5(NS, label))

SAST = dt.timezone(dt.timedelta(hours=2))
NOW = dt.datetime.now(SAST).replace(microsecond=0)
START = (NOW - dt.timedelta(days=90)).replace(hour=0, minute=0, second=0)

# ---- Menu (real SA takeaway, market prices) -------------------------------------------------
# key: (name, category, price, cost, popularity weight)
MENU = {
    "beef_burger":  ("Beef Burger",   "Burgers", 65, 32, 10),
    "cheese_burger":("Cheese Burger", "Burgers", 75, 38, 7),
    "chicken_burger":("Chicken Burger","Burgers", 70, 34, 6),
    "quarter_kota": ("Quarter Kota",  "Kotas",   45, 20, 14),   # SA staple — busiest
    "half_kota":    ("Half Kota",     "Kotas",   65, 30, 9),
    "full_kota":    ("Full Kota",     "Kotas",   85, 40, 5),
    "chicken_wrap": ("Chicken Wrap",  "Wraps",   68, 33, 8),
    "beef_wrap":    ("Beef Wrap",     "Wraps",   72, 36, 6),
    "veggie_wrap":  ("Veggie Wrap",   "Wraps",   60, 28, 2),    # slow mover
    "chips":        ("Chips",         "Sides",   30, 10, 11),
    "onion_rings":  ("Onion Rings",   "Sides",   35, 13, 4),
    "wings6":       ("Wings 6pc",     "Sides",   55, 26, 5),
    "coke":         ("Coke 440ml",    "Drinks",  22, 9,  9),
    "juice":        ("Juice",         "Drinks",  28, 11, 4),
}
MID = {k: uid("item-"+k) for k in MENU}        # menu_item ids
keys = list(MENU)
weights = [MENU[k][4] for k in keys]

# ---- Demand model: NON-UNIFORM days (the user's ask) ----------------------------------------
DOW = {0:0.8, 1:0.8, 2:0.9, 3:1.0, 4:1.6, 5:2.2, 6:1.4}   # Mon..Sun — Fri/Sat busy
BASE_ORDERS = 25
def day_factor(d):
    f = DOW[d.weekday()]
    if d.day >= 25 or d.day <= 2: f *= 1.30          # month-end payday bump
    if rng.random() < 0.10:      f *= 0.50           # ~10% slow/rainy days
    return f

def price(k): return MENU[k][1-1+2]  # price index 2
def P(k): return MENU[k][2]

# ---- Promo scenarios (injected ground truth) ------------------------------------------------
# day = days after START; lift = injected demand multiplier on the target during the window
def D(day, h=12): return (START + dt.timedelta(days=day, hours=h))
PROMOS = [
  dict(key="p1", title="Beef Burger 15% off",  scope="PRODUCT", item="beef_burger",
       start=D(18), end=D(28), pct=15, lift=0.35, fundedBy="STORE", ptype="PERCENT_OFF"),
  dict(key="p2", title="Cheese Burger 20% off", scope="PRODUCT", item="cheese_burger",
       start=D(33), end=D(41), pct=20, lift=-0.20, fundedBy="STORE", ptype="PERCENT_OFF"),
  dict(key="p3", title="Chicken Wrap 10% off",  scope="PRODUCT", item="chicken_wrap",
       start=D(46), end=D(54), pct=10, lift=0.00, fundedBy="STORE", ptype="PERCENT_OFF"),
  dict(key="p4", title="Veggie Wrap 25% off",   scope="PRODUCT", item="veggie_wrap",
       start=D(50), end=D(58), pct=25, lift=0.30, fundedBy="STORE", ptype="PERCENT_OFF"),
  dict(key="p5", title="Beef Burger Flash 12%", scope="PRODUCT", item="beef_burger",
       start=D(62), end=D(65), pct=12, lift=0.25, fundedBy="STORE", ptype="PERCENT_OFF"),  # short + repeat item
  dict(key="p6", title="R10 off over R120",     scope="ALL", item=None,
       start=D(80), end=D(87), pct=10, lift=0.12, fundedBy="STORE", ptype="PERCENT_OFF", minspend=120),
  dict(key="p7", title="Free delivery weekend",  scope="ALL", item=None,
       start=D(83), end=D(89), pct=0, lift=0.08, fundedBy="PLATFORM", ptype="FREE_DELIVERY"),
  dict(key="p8a", title="Quarter Kota 20% off",  scope="PRODUCT", item="quarter_kota",
       start=D(20), end=D(28), pct=20, lift=0.40, fundedBy="STORE", ptype="PERCENT_OFF", overlap="kota"),
  dict(key="p8b", title="Kota Combo Deal",       scope="PRODUCT", item="quarter_kota",
       start=D(22), end=D(28), pct=15, lift=0.0,  fundedBy="STORE", ptype="PERCENT_OFF", overlap="kota"),  # concurrent, no extra real lift
]
for p in PROMOS: p["id"] = uid("promo-"+p["key"])
DELIV_FEE = 25.0

# ---- Generate base orders (promo-unaware), then inject promo-incremental demand --------------
orders = []   # each: dict(id, ts, items=[(key,qty)], promo=None|promo, subtotal, discount, waived)
def gen_order(ts, force_item=None):
    n = rng.choices([1,2,3],[0.5,0.35,0.15])[0]
    chosen = []
    if force_item: chosen.append(force_item)
    while len(chosen) < n:
        k = rng.choices(keys, weights)[0]
        if k not in chosen: chosen.append(k)
    items = [(k, rng.choices([1,2],[0.8,0.2])[0]) for k in chosen]
    return dict(id=None, ts=ts, items=items, promo=None)

# base demand, day by day
for dnum in range(90):
    day = START + dt.timedelta(days=dnum)
    n_orders = max(0, int(round(rng.gauss(BASE_ORDERS*day_factor(day), BASE_ORDERS*0.12))))
    for _ in range(n_orders):
        ts = day + dt.timedelta(hours=rng.randint(10,21), minutes=rng.randint(0,59))
        orders.append(gen_order(ts))

def in_window(ts, p): return p["start"] <= ts < p["end"]

# inject promo-incremental demand (extra orders) for each promo with positive lift
def base_units_in_window(item, s, e):
    return sum(q for o in orders for (k,q) in o["items"] if k==item and s<=o["ts"]<e)
def base_orders_in_window(s, e):
    return sum(1 for o in orders if s<=o["ts"]<e)

# snapshot base in-window counts BEFORE modifying, so each promo's injection is measured off base
snap = {}
for p in PROMOS:
    if p["scope"]=="PRODUCT": snap[p["key"]] = base_units_in_window(p["item"], p["start"], p["end"])
    else:                     snap[p["key"]] = base_orders_in_window(p["start"], p["end"])

extra = []
for p in PROMOS:
    days = max(1,(p["end"]-p["start"]).days)
    if p["lift"] > 0:
        if p["scope"]=="PRODUCT":
            for _ in range(int(round(p["lift"]*snap[p["key"]]))):
                off = rng.random()*days
                ts = p["start"] + dt.timedelta(days=off, hours=rng.randint(0,6))
                if ts >= p["end"]: ts = p["end"]-dt.timedelta(hours=1)
                extra.append(gen_order(ts, force_item=p["item"]))
        else:  # ALL — extra whole orders
            for _ in range(int(round(p["lift"]*snap[p["key"]]))):
                off = rng.random()*days
                ts = p["start"] + dt.timedelta(days=off, hours=rng.randint(0,8))
                if ts >= p["end"]: ts = p["end"]-dt.timedelta(hours=1)
                extra.append(gen_order(ts))
    elif p["lift"] < 0 and p["scope"]=="PRODUCT":
        # a real loser: remove |lift| of the item's in-window units
        inwin = [(o,i) for o in orders for i,(k,qq) in enumerate(o["items"]) if k==p["item"] and in_window(o["ts"],p)]
        rng.shuffle(inwin)
        need = int(round(abs(p["lift"])*snap[p["key"]])); got=0
        for o,i in inwin:
            if got>=need: break
            k,qq = o["items"][i]; take=min(qq, need-got)
            o["items"][i]=(k,qq-take); got+=take
orders += extra
for o in orders: o["items"]=[(k,qq) for (k,qq) in o["items"] if qq>0]
orders = [o for o in orders if o["items"]]
orders.sort(key=lambda o: o["ts"])

# ---- Attribute promos to orders (discount + promo_id) ----------------------------------------
# PRODUCT: orders in window containing the item. ALL: every order in window (min spend gate).
# Overlap: BOTH kota promos target the same item over overlapping windows — attribute each order
# to the FIRST promo whose window covers it (one promo_id per order), but productSales (units)
# will still let BOTH promos claim the elevated units (the double-count we are probing).
def subtotal(o): return sum(P(k)*q for (k,q) in o["items"])
for o in orders:
    st = subtotal(o); o["subtotal"]=st; o["discount"]=0.0; o["waived"]=0.0; o["promo"]=None
    for p in PROMOS:
        if not in_window(o["ts"], p): continue
        if p["scope"]=="PRODUCT":
            if not any(k==p["item"] for (k,_) in o["items"]): continue
            if p["ptype"]=="PERCENT_OFF":
                itemtot = sum(P(k)*q for (k,q) in o["items"] if k==p["item"])
                o["discount"] = round(itemtot*p["pct"]/100.0,2)
        else:
            if p.get("minspend") and st < p["minspend"]: continue
            if p["ptype"]=="FREE_DELIVERY": o["waived"]=DELIV_FEE
            elif p["ptype"]=="PERCENT_OFF": o["discount"]=round(st*p["pct"]/100.0,2)
        o["promo"]=p; break   # one promo_id per order
    o["total"]=round(o["subtotal"]-o["discount"],2)

# ---- Compute the ENGINE's expected output from realized data (arithmetic ground truth) -------
def units(item, s, e): return sum(q for o in orders for (k,q) in o["items"] if k==item and s<=o["ts"]<e)
def norders(s, e):     return sum(1 for o in orders if s<=o["ts"]<e)
def revenue(s, e):     return sum(o["total"] for o in orders if s<=o["ts"]<e)
def daycount(s,e):     return max(0.25,(e-s).total_seconds()/86400.0)

gt = {"now": NOW.isoformat(), "tenant": TENANT, "totalOrders": len(orders), "promos": []}
for p in PROMOS:
    s,e = p["start"], p["end"]; dur=daycount(s,e)
    bstart = s - dt.timedelta(days=14); bdays=daycount(bstart,s)
    rec = dict(key=p["key"], id=p["id"], title=p["title"], scope=p["scope"], item=p["item"],
               injectedLiftPct=round(p["lift"]*100), windowDays=round((e-s).days),
               overlap=p.get("overlap"))
    if p["scope"]=="PRODUCT":
        ib = units(p["item"], bstart, s); idu = units(p["item"], s, e)
        sb = norders(bstart, s); sd = norders(s, e)
        itemPct = round(((idu/dur)-(ib/bdays))/(ib/bdays)*100) if (ib>=5 and ib>0) else None
        storePct = round(((sd/dur)-(sb/bdays))/(sb/bdays)*100) if (sb>=10 and sb>0) else None
        rec.update(baselineUnits=ib, duringUnits=idu, expectedItemPct=itemPct,
                   expectedStorePct=storePct, storeBaseCount=sb, storeDurCount=sd,
                   baseDays=round(bdays,3), durDays=round(dur,3),
                   start=s.isoformat(), end=e.isoformat(),
                   expectedNetLiftPct=(itemPct-storePct) if (itemPct is not None and storePct is not None) else None)
    else:
        rb = revenue(bstart, s); rd = revenue(s, e)
        exp = round(rb/bdays*dur); inc = round(rd-exp)
        cost = round(sum(o["discount"]+o["waived"] for o in orders if o["promo"] and o["promo"]["id"]==p["id"]))
        rec.update(baselineRevenue=round(rb), duringRevenue=round(rd), expectedRevenue=exp,
                   incrementalRevenue=inc, promoCost=cost, expectedNetRevenueLift=inc-cost,
                   redeemedOrders=sum(1 for o in orders if o["promo"] and o["promo"]["id"]==p["id"]),
                   exposedOrders=norders(s,e))
    gt["promos"].append(rec)

# ---- Emit SQL --------------------------------------------------------------------------------
def q(s): return s.replace("'", "''")
sql = []
sql.append("BEGIN;")
# clean prior seed (orders tagged, our menu items, our promos)
sql.append(f"DELETE FROM order_item WHERE order_id IN (SELECT id FROM orders WHERE order_notes='{SEEDTAG}');")
sql.append(f"DELETE FROM orders WHERE order_notes='{SEEDTAG}';")
ids_in = ",".join(f"'{MID[k]}'" for k in MENU)
sql.append(f"DELETE FROM promotion_products WHERE product_id IN ({ids_in});")
sql.append(f"DELETE FROM menu_items WHERE id IN ({ids_in});")
pids = ",".join(f"'{p['id']}'" for p in PROMOS)
sql.append(f"DELETE FROM promotions WHERE id IN ({pids});")
# Drinks category (others exist)
sql.append(f"INSERT INTO categories (id,name,tenant_id) VALUES ('{uid('cat-drinks')}','Drinks','{TENANT}') ON CONFLICT DO NOTHING;")
# menu
for k,(name,cat,pr,co,pop) in MENU.items():
    sql.append(f"INSERT INTO menu_items (id,name,category,price,cost,is_available,stock,reserved_stock,low_stock_threshold,tenant_id,version) "
               f"VALUES ('{MID[k]}','{q(name)}','{cat}',{pr},{co},true,99999,0,5,'{TENANT}',0);")
# promos
for p in PROMOS:
    pct = p["pct"] if p["ptype"]=="PERCENT_OFF" else "NULL"
    tp  = f"'{p['item'] and MID[p['item']] or ''}'" if p["scope"]=="PRODUCT" else "NULL"
    tp  = f"'{MID[p['item']]}'" if p["scope"]=="PRODUCT" else "NULL"
    ms  = p.get("minspend","NULL")
    sql.append(
        "INSERT INTO promotions (id,title,active,applies_to,promo_type,discount_percent,min_spend,"
        "start_at,end_at,featured,target_product_id,tenant_id) VALUES "
        f"('{p['id']}','{q(p['title'])}',false,'{p['scope']}','{p['ptype']}',{pct},{ms},"
        f"'{p['start'].isoformat()}','{p['end'].isoformat()}',false,{tp},'{TENANT}');")
# orders + items
for i,o in enumerate(orders):
    oid = uid(f"order-{i}"); o["id"]=oid
    pid = f"'{o['promo']['id']}'" if o["promo"] else "NULL"
    ptype = f"'{o['promo']['ptype']}'" if o["promo"] else "NULL"
    pfund = f"'{o['promo']['fundedBy']}'" if o["promo"] else "NULL"
    waived = o["waived"] if o["waived"] else "NULL"
    deliv_at = (o["ts"]+dt.timedelta(minutes=40)).isoformat()
    sql.append(
        "INSERT INTO orders (id,user_id,tenant_id,order_date,status,total_amount,delivery_fee,"
        "discount_amount,promo_id,promo_type,promo_funded_by,waived_delivery_fee,order_notes,"
        "otp_verified,is_group_order,delivered_at) VALUES "
        f"('{oid}','{USER}','{TENANT}','{o['ts'].isoformat()}','Delivered',{o['total']},{DELIV_FEE},"
        f"{o['discount']},{pid},{ptype},{pfund},{waived},'{SEEDTAG}',true,false,'{deliv_at}');")
    for j,(k,qty) in enumerate(o["items"]):
        iid = uid(f"oi-{i}-{j}")
        sql.append(f"INSERT INTO order_item (id,order_id,menu_item_id,name,quantity,total_price) VALUES "
                   f"('{iid}','{oid}','{MID[k]}','{q(MENU[k][0])}',{qty},{P(k)*qty});")
sql.append("COMMIT;")

here = os.path.dirname(os.path.abspath(__file__))
open(os.path.join(here,"seed.sql"),"w",encoding="utf-8").write("\n".join(sql))
json.dump(gt, open(os.path.join(here,"ground_truth.json"),"w",encoding="utf-8"), indent=2)

print(f"orders={len(orders)}  items={sum(len(o['items']) for o in orders)}  sql_lines={len(sql)}")
print("per-promo realized (engine-expected):")
for r in gt["promos"]:
    if r["scope"]=="PRODUCT":
        print(f"  {r['key']:4} {r['title']:24} inj={r['injectedLiftPct']:>4}%  base_u={r['baselineUnits']:>3} dur_u={r['duringUnits']:>3} "
              f"expItem={r['expectedItemPct']} expStore={r['expectedStorePct']} expNet={r['expectedNetLiftPct']}")
    else:
        print(f"  {r['key']:4} {r['title']:24} inj={r['injectedLiftPct']:>4}%  expRev={r['expectedRevenue']} during={r['duringRevenue']} "
              f"cost={r['promoCost']} expNetR={r['expectedNetRevenueLift']} redeemed={r['redeemedOrders']}/{r['exposedOrders']}")
