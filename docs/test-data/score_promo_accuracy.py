#!/usr/bin/env python3
"""Score the promo engine output against the seeded ground truth. Reads ground_truth.json +
the captured outcomes.json / economics.json. Prints accuracy tables + saves accuracy_results.json."""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
gt = json.load(open(os.path.join(here,"ground_truth.json")))
out = json.load(open(os.path.join(here,"outcomes.json")))["outcomes"]
GTP = {p["key"]: p for p in gt["promos"]}

# match engine PRODUCT outcomes (target name + discount %) and ALL (title) to gt keys
PMATCH = {("Beef Burger",15):"p1",("Cheese Burger",20):"p2",("Chicken Wrap",10):"p3",
          ("Veggie Wrap",25):"p4",("Beef Burger",12):"p5",("Quarter Kota",20):"p8a",("Quarter Kota",15):"p8b"}
AMATCH = {"R10 off over R120":"p6","Free delivery weekend":"p7"}

rows=[]
for r in out:
    if r.get("scope")=="ALL":
        key=AMATCH.get(r.get("title"))
        if not key: continue
        g=GTP[key]
        rows.append(dict(key=key, kind="ALL", title=r["title"], injected=g["injectedLiftPct"],
            engine_netRevLift=r.get("netRevenueLift"), expected_netRevLift=g["expectedNetRevenueLift"],
            during=round(r.get("duringRevenue",0)), expected=r.get("expectedRevenue"), cost=r.get("promoCost"),
            incremental=round(r.get("duringRevenue",0))-r.get("expectedRevenue",0),
            signal=r.get("signal")))
    else:
        key=PMATCH.get((r.get("target"), round(r.get("discountPercent",0))))
        if not key: continue
        g=GTP[key]
        eng=r.get("netLiftPercent")
        rows.append(dict(key=key, kind="PRODUCT", title=g["title"], injected=g["injectedLiftPct"],
            engine_netLift=eng, expected_netLift=g["expectedNetLiftPct"],
            err_vs_injected=(eng-g["injectedLiftPct"]) if eng is not None else None,
            err_vs_expected=(eng-g["expectedNetLiftPct"]) if (eng is not None and g["expectedNetLiftPct"] is not None) else None,
            signal=r.get("signal"), quality=r.get("dataQuality")))

print("\n=== PRODUCT net-lift accuracy (engine vs injected truth & vs independent recompute) ===")
print(f"{'promo':5}{'title':24}{'inj%':>5}{'engine%':>8}{'recompute%':>11}{'err_vs_truth':>13}{'signal':>11}{'quality':>8}")
prod=[r for r in rows if r["kind"]=="PRODUCT"]
for r in sorted(prod,key=lambda x:x['key']):
    print(f"{r['key']:5}{r['title']:24}{r['injected']:>5}{str(r['engine_netLift']):>8}{str(r['expected_netLift']):>11}"
          f"{str(r['err_vs_injected']):>13}{r['signal']:>11}{r['quality']:>8}")
errs=[abs(r["err_vs_injected"]) for r in prod if r["err_vs_injected"] is not None]
arith=[abs(r["err_vs_expected"]) for r in prod if r["err_vs_expected"] is not None]
mae=sum(errs)/len(errs); bias=sum(r["err_vs_injected"] for r in prod)/len(prod)
print(f"\n  MAE vs injected truth = {mae:.1f} pp   bias = {bias:+.1f} pp (negative = underestimates lift)")
print(f"  MAE vs independent recompute = {sum(arith)/len(arith):.2f} pp  (≈0 ⇒ engine arithmetic is correct)")

print("\n=== Calibration: does dataQuality reflect actual accuracy? ===")
for qual in ["HIGH","MEDIUM"]:
    qs=[r for r in prod if r["quality"]==qual and r["err_vs_injected"] is not None]
    if qs:
        m=sum(abs(r["err_vs_injected"]) for r in qs)/len(qs)
        worst=max(qs,key=lambda x:abs(x["err_vs_injected"]))
        print(f"  {qual:6}: n={len(qs)}  mean|err|={m:.0f}pp  worst={worst['title']} ({worst['err_vs_injected']:+}pp, truth {worst['injected']}%)")

print("\n=== ALL-scope economics: the netRevenueLift double-count ===")
for r in [x for x in rows if x["kind"]=="ALL"]:
    true_net = r["incremental"]  # during(net of discount) - expected ⇒ already nets the discount
    print(f"  {r['title']:22} engine_netRevLift=R{r['engine_netRevLift']}  during(net)=R{r['during']} expected=R{r['expected']} "
          f"cost=R{round(r['cost'])}")
    print(f"     incremental(=during-expected, already net of discount) = R{r['incremental']}  "
          f"-> engine then subtracts cost AGAIN = R{r['engine_netRevLift']}  (discount double-counted by ~R{round(r['cost'])})")

print("\n=== Learning fidelity (promo_outcome_record) + overlap double-count ===")
print("  Quarter Kota recorded TWICE (p8a +40, p8b +8) for ONE real +40% event:")
print("    prior avg = (40+8)/2 = 24%  (diluted)   OR total credit = 48% for a 40% lift  -> overlap corrupts learning")
print("  Beef Burger recorded twice legitimately (p1 +23, p5 +11) -> prior avg = 17%")

json.dump({"product_rows":prod,"all_rows":[r for r in rows if r['kind']=='ALL'],
           "mae_vs_injected":mae,"bias":bias}, open(os.path.join(here,"accuracy_results.json"),"w"), indent=2)
print("\nsaved accuracy_results.json")
