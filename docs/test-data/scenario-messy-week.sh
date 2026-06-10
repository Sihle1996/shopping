#!/usr/bin/env bash
#
# scenario-messy-week.sh — adversarial "Messy Week" probe of CraveIt's decision heuristics.
#
# The base seeder proves the loops work when reality is CLEAN. This proves where the
# DETERMINISTIC heuristics stay HONEST vs quietly MISLEADING vs an outright BUG when reality
# is contradictory (margin shock, overlapping promos, exogenous demand, a cost-cause alert).
# It does NOT test "intelligent adaptation" — this system has none; it tests semantic fidelity.
#
# Five probes, each emits HONEST / MISLEADING / BUG (a plain pass/fail would hide the point):
#   1 margin filter drops a now-unprofitable star          -> expect HONEST
#   2 priorObserved has no recency decay                   -> expect MISLEADING
#   3 overlapping ALL promos double-count net-lift          -> expect BUG
#   4 calibration mis-learns from a COST cause (flat volume) -> expect MISLEADING
#   5 net-lift claims an EXOGENOUS demand spike as its own  -> expect MISLEADING
#
# SYNTHETIC, LOCAL-ONLY, fully removable. Tags: orders delivery_address='MESSYWEEK',
# promos title 'MESSY:%', alerts alert_key '%:messy', PromoOutcomeRecords via MESSY promos.
# Probe 1 mutates one item's cost; the original is backed up to train_seed_cost_backup and
# restored on --teardown.
#
# Usage:  PGPASSWORD=... ./scenario-messy-week.sh --i-understand-this-is-synthetic
#         PGPASSWORD=... ./scenario-messy-week.sh --teardown
# Run on a CLEAN base first: ./seed-training-data.sh --teardown   (Probe 2 needs Coca Cola's only
# promo history to be the two records it seeds; the base harness would add more and skew the average).
set -euo pipefail

export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5433}" PGUSER="${PGUSER:-postgres}" PGDATABASE="${PGDATABASE:-ecommerce}"
export PGOPTIONS='-c client_min_messages=warning'   # quiet informational NOTICEs
API="${API:-http://localhost:8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:-testuser1@example.com}"; ADMIN_PASS="${ADMIN_PASS:-123456}"

MODE=seed; ACK=0
for a in "$@"; do case "$a" in
  --teardown) MODE=teardown;; --i-understand-this-is-synthetic) ACK=1;; *) echo "unknown arg: $a"; exit 2;; esac; done
case "$PGHOST" in localhost|127.0.0.1) ;; *) echo "REFUSING: PGHOST='$PGHOST' is not local."; exit 1;; esac
[ -n "${PGPASSWORD:-}" ] || { echo "Set PGPASSWORD."; exit 1; }

PSQL="psql -v ON_ERROR_STOP=1 -tA"
TK=$($PSQL -c "SELECT id FROM tenants WHERE slug='test-kitchen'")
[ -n "$TK" ] || { echo "Test Kitchen tenant not found."; exit 1; }
CUST=$($PSQL -c "SELECT id FROM _user WHERE email='testuser2@example.com' LIMIT 1")
itemid() { $PSQL -c "SELECT id FROM menu_items WHERE name='$1' AND tenant_id='$TK' LIMIT 1"; }
CB=$(itemid 'Chicken Burger'); COKE=$(itemid 'Coca Cola'); FRIES=$(itemid 'Regular Fries')
BEEFKOTA=$(itemid 'Beef Kota'); BOERIE=$(itemid 'Boerie Kota'); BEEFRIBS=$(itemid 'Beef Ribs')
[ -n "$CB" ] && [ -n "$COKE" ] && [ -n "$BOERIE" ] && [ -n "$BEEFRIBS" ] || { echo "Expected menu items not found."; exit 1; }

teardown() {
  $PSQL >/dev/null <<SQL
-- restore any cost we shocked, then drop the backup (table may not exist yet on a first run)
CREATE TABLE IF NOT EXISTS train_seed_cost_backup (menu_item_id uuid PRIMARY KEY, orig_cost double precision);
UPDATE menu_items mi SET cost = b.orig_cost FROM train_seed_cost_backup b WHERE mi.id = b.menu_item_id;
DROP TABLE IF EXISTS train_seed_cost_backup;
DELETE FROM order_item WHERE order_id IN (SELECT id FROM orders WHERE delivery_address='MESSYWEEK');
DELETE FROM promo_outcome_record WHERE promo_id IN (SELECT id FROM promotions WHERE title LIKE 'MESSY:%');
DELETE FROM alert_outcome WHERE alert_key LIKE '%:messy';
DELETE FROM orders WHERE delivery_address='MESSYWEEK';
DELETE FROM promotions WHERE title LIKE 'MESSY:%';
SQL
  local o p por ao bk
  o=$($PSQL -c "SELECT count(*) FROM orders WHERE delivery_address='MESSYWEEK'")
  p=$($PSQL -c "SELECT count(*) FROM promotions WHERE title LIKE 'MESSY:%'")
  por=$($PSQL -c "SELECT count(*) FROM promo_outcome_record WHERE promo_id IN (SELECT id FROM promotions WHERE title LIKE 'MESSY:%')")
  ao=$($PSQL -c "SELECT count(*) FROM alert_outcome WHERE alert_key LIKE '%:messy'")
  bk=$($PSQL -c "SELECT count(*) FROM information_schema.tables WHERE table_name='train_seed_cost_backup'")
  [ "$o" = 0 ] && [ "$p" = 0 ] && [ "$por" = 0 ] && [ "$ao" = 0 ] && [ "$bk" = 0 ] \
    || { echo "TEARDOWN FAILED — residue: orders=$o promos=$p por=$por alerts=$ao cost_backup_table=$bk"; exit 1; }
}

if [ "$MODE" = teardown ]; then teardown; echo "Teardown OK — costs restored, 0 MESSYWEEK residue."; exit 0; fi
[ "$ACK" = 1 ] || { echo "Refusing to seed without --i-understand-this-is-synthetic."; exit 1; }
teardown >/dev/null   # idempotent (also restores any prior cost shock before re-seeding)

# ---------- seed the messy week ----------
$PSQL >/dev/null <<SQL
-- General demand over 30d. Chicken Burger HEAVY (a strong suggestion candidate, 64% margin) so the
-- margin shock can later drop it; Coca Cola / Fries / Beef Kota moderate (set the median + baselines).
WITH g AS (SELECT gen_random_uuid() id, now()-make_interval(days=>(random()*30)::int,hours=>(random()*12)::int) od FROM generate_series(1,40))
INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address)
SELECT g.id,'$CUST','$TK',89,g.od,'Delivered',false,false,'MESSYWEEK' FROM g;
INSERT INTO order_item (id,order_id,menu_item_id,quantity,total_price,name)
SELECT gen_random_uuid(),o.id,'$CB',1,89,'Chicken Burger' FROM orders o WHERE o.delivery_address='MESSYWEEK' AND NOT EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id=o.id);
-- Coca Cola = 2nd-heaviest (Probe-2 subject: high margin, stays suggested after the CB shock)
WITH g AS (SELECT gen_random_uuid() id, now()-make_interval(days=>(random()*30)::int) od FROM generate_series(1,25))
INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address)
SELECT g.id,'$CUST','$TK',20,g.od,'Delivered',false,false,'MESSYWEEK' FROM g;
INSERT INTO order_item (id,order_id,menu_item_id,quantity,total_price,name)
SELECT gen_random_uuid(),o.id,'$COKE',1,20,'Coca Cola' FROM orders o WHERE o.delivery_address='MESSYWEEK' AND NOT EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id=o.id);
-- Regular Fries + Beef Kota = lighter (help set the margin median + provide alternative candidates/baseline)
WITH g AS (SELECT gen_random_uuid() id, now()-make_interval(days=>(random()*30)::int) od FROM generate_series(1,8))
INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address)
SELECT g.id,'$CUST','$TK',30,g.od,'Delivered',false,false,'MESSYWEEK' FROM g;
INSERT INTO order_item (id,order_id,menu_item_id,quantity,total_price,name)
SELECT gen_random_uuid(),o.id,'$FRIES',1,30,'Regular Fries' FROM orders o WHERE o.delivery_address='MESSYWEEK' AND NOT EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id=o.id);
WITH g AS (SELECT gen_random_uuid() id, now()-make_interval(days=>(random()*30)::int) od FROM generate_series(1,8))
INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address)
SELECT g.id,'$CUST','$TK',55,g.od,'Delivered',false,false,'MESSYWEEK' FROM g;
INSERT INTO order_item (id,order_id,menu_item_id,quantity,total_price,name)
SELECT gen_random_uuid(),o.id,'$BEEFKOTA',1,55,'Beef Kota' FROM orders o WHERE o.delivery_address='MESSYWEEK' AND NOT EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id=o.id);

-- PROBE 2 — priorObserved has no recency decay: Coca Cola gets a RECENT +5% and a 90-DAY-OLD +40%.
INSERT INTO promotions (id,title,start_at,end_at,applies_to,active,featured,promo_type,min_spend,discount_percent,target_product_id,tenant_id) VALUES
 (gen_random_uuid(),'MESSY: Coke recent', now()-interval '12 days', now()-interval '9 days','PRODUCT',false,false,'PERCENT_OFF',0,10,'$COKE','$TK'),
 (gen_random_uuid(),'MESSY: Coke stale',  now()-interval '95 days', now()-interval '92 days','PRODUCT',false,false,'PERCENT_OFF',0,10,'$COKE','$TK');
INSERT INTO promo_outcome_record (id,tenant_id,product_id,promo_id,net_lift_percent,sample_units,recorded_at) VALUES
 (gen_random_uuid(),'$TK','$COKE',(SELECT id FROM promotions WHERE title='MESSY: Coke recent'), 5,20, now()-interval '9 days'),
 (gen_random_uuid(),'$TK','$COKE',(SELECT id FROM promotions WHERE title='MESSY: Coke stale'), 40,22, now()-interval '92 days');

-- PROBE 3 — overlapping ALL promos double-count: two ALL promos sharing window [7d,5d] (ended within
-- the 7-day promo-economics window), both with redeemers.
INSERT INTO promotions (id,title,start_at,end_at,applies_to,active,featured,promo_type,min_spend,discount_amount,tenant_id) VALUES
 (gen_random_uuid(),'MESSY: Overlap A (free delivery)', now()-interval '7 days', now()-interval '5 days','ALL',false,false,'FREE_DELIVERY',0,NULL,'$TK'),
 (gen_random_uuid(),'MESSY: Overlap B (R20 off)',       now()-interval '7 days', now()-interval '5 days','ALL',false,false,'AMOUNT_OFF',0,20,'$TK');
INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address,promo_id,promo_type,waived_delivery_fee,promo_funded_by,promo_code)
SELECT gen_random_uuid(),'$CUST','$TK',200, now()-make_interval(days=>5,hours=>(random()*48)::int),'Delivered',false,false,'MESSYWEEK',
 (SELECT id FROM promotions WHERE title='MESSY: Overlap A (free delivery)'),'FREE_DELIVERY',25,'PLATFORM','MESSY: Overlap A' FROM generate_series(1,10);
INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address,promo_id,promo_type,discount_amount,promo_funded_by,promo_code)
SELECT gen_random_uuid(),'$CUST','$TK',200, now()-make_interval(days=>5,hours=>(random()*48)::int),'Delivered',false,false,'MESSYWEEK',
 (SELECT id FROM promotions WHERE title='MESSY: Overlap B (R20 off)'),'AMOUNT_OFF',20,'STORE','MESSY: Overlap B' FROM generate_series(1,10);

-- PROBE 5 — exogenous spike: ONE ALL promo [4d,1d] (ended yesterday) with FEW redeemers, but a big
-- NON-promo demand spike in the same window (organic). Net-lift claims the spike as its own incremental.
INSERT INTO promotions (id,title,start_at,end_at,applies_to,active,featured,promo_type,min_spend,discount_amount,tenant_id) VALUES
 (gen_random_uuid(),'MESSY: Exogenous (free delivery)', now()-interval '4 days', now()-interval '1 day','ALL',false,false,'FREE_DELIVERY',0,NULL,'$TK');
INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address,promo_id,promo_type,waived_delivery_fee,promo_funded_by,promo_code)
SELECT gen_random_uuid(),'$CUST','$TK',150, now()-make_interval(days=>1,hours=>(random()*72)::int),'Delivered',false,false,'MESSYWEEK',
 (SELECT id FROM promotions WHERE title='MESSY: Exogenous (free delivery)'),'FREE_DELIVERY',25,'PLATFORM','MESSY: Exogenous' FROM generate_series(1,3);
-- the organic spike (NO promo_id) — 25 extra orders in the same [4d,1d] window
INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address)
SELECT gen_random_uuid(),'$CUST','$TK',180, now()-make_interval(days=>1,hours=>(random()*72)::int),'Delivered',false,false,'MESSYWEEK' FROM generate_series(1,25);

-- PROBE 4 — calibration mis-learns from a COST cause: a 'below-cost' alert on Boerie Kota whose
-- DEMAND is flat (observed ~= baseline). The alert was correct (margin), but volume didn't move.
-- dedicated flat recent sales (~baseline rate) in the observed window [0,2d]
WITH o AS (INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address)
  SELECT gen_random_uuid(),'$CUST','$TK',75, now()-make_interval(hours=>(6+random()*36)::int),'Delivered',false,false,'MESSYWEEK' FROM generate_series(1,3) RETURNING id)
INSERT INTO order_item (id,order_id,menu_item_id,quantity,total_price,name) SELECT gen_random_uuid(),o.id,'$BOERIE',1,75,'Boerie Kota' FROM o;
-- 3 below-cost outcomes (samples=3 beats K=3 shrinkage); baseline ~= observed rate -> factor ~1.0
INSERT INTO alert_outcome (id,tenant_id,alert_key,alert_type,item_id,predicted_revenue_at_risk,predicted_net_at_risk,baseline_units30d,applied_at)
SELECT gen_random_uuid(),'$TK','below-cost:$BOERIE:messy','below-cost','$BOERIE',600,260,30, now()-interval '3 days'-make_interval(hours=>g*6) FROM generate_series(0,2) g;
SQL

# Probe 1 needs Chicken Burger to be suggested FIRST, then dropped by the cost shock. We snapshot its
# cost (so teardown restores) but DON'T shock yet — the probe runner does the before/after.
$PSQL >/dev/null <<SQL
CREATE TABLE IF NOT EXISTS train_seed_cost_backup (menu_item_id uuid PRIMARY KEY, orig_cost double precision);
INSERT INTO train_seed_cost_backup (menu_item_id, orig_cost) SELECT id, cost FROM menu_items WHERE id='$CB' ON CONFLICT DO NOTHING;
-- pre-shock: give Chicken Burger a healthy margin (~83%) so it IS a suggestion candidate; the probe
-- then shocks its cost to invert that. (teardown restores the original from the backup.)
UPDATE menu_items SET cost = 15 WHERE id='$CB';
SQL

POR=$($PSQL -c "SELECT count(*) FROM promo_outcome_record WHERE promo_id IN (SELECT id FROM promotions WHERE title LIKE 'MESSY:%')")
AO=$($PSQL -c "SELECT count(*) FROM alert_outcome WHERE alert_key LIKE '%:messy'")
[ "${POR:-0}" -gt 0 ] && [ "${AO:-0}" -gt 0 ] || { echo "SEED INCOMPLETE — por=$POR ao=$AO. Run --teardown and retry."; exit 1; }
echo "Messy-week seeded ($POR promo records, $AO alert outcomes). Running probes..."

# ---------- probe runner ----------
TOK=$(curl -s -X POST "$API/api/login" -H "Content-Type: application/json" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" | sed 's/.*"token":"\([^"]*\)".*/\1/')
[ -n "$TOK" ] || { echo "Could not log in to $API as $ADMIN_EMAIL — is the backend up?"; exit 1; }
AUTH=(-H "Authorization: Bearer $TOK")
sug() { curl -s -X POST "$API/api/admin/ai/suggest-promotions" "${AUTH[@]}" -H "Content-Type: application/json" -d '{}'; }

# PROBE 1 — margin filter: Chicken Burger suggested BEFORE, dropped AFTER a cost shock.
BEFORE=$(sug | python -c "import sys,json; print(sum(1 for s in json.load(sys.stdin).get('suggestions',[]) if s.get('proposedPromo',{}).get('targetProductId')=='$CB'))")
$PSQL -c "UPDATE menu_items SET cost=78 WHERE id='$CB'" >/dev/null   # margin 64% -> 12% (well below median)
AFTER=$(sug | python -c "import sys,json; print(sum(1 for s in json.load(sys.stdin).get('suggestions',[]) if s.get('proposedPromo',{}).get('targetProductId')=='$CB'))")
P1="MISLEADING"; [ "$BEFORE" -ge 1 ] && [ "$AFTER" = 0 ] && P1="HONEST"; [ "$BEFORE" = 0 ] && P1="INCONCLUSIVE(not suggested pre-shock)"

# PROBE 2 — priorObserved has no recency decay: Coca Cola avg should be the PLAIN mean (~22), giving a
# 90-day-old +40% equal weight with a recent +5%. Recency-weighted would be ~ +5..+10.
COKEPRIOR=$(sug | python -c "
import sys,json
for s in json.load(sys.stdin).get('suggestions',[]):
    if s.get('proposedPromo',{}).get('targetProductId')=='$COKE':
        p=s.get('analysis',{}).get('priorObserved'); print(p['avgNetPercent'] if p else 'none'); break
else: print('not-suggested')")
P2="INCONCLUSIVE"; case "$COKEPRIOR" in ''|none|not-suggested) P2="INCONCLUSIVE(coke not suggested: $COKEPRIOR)";; *) [ "$COKEPRIOR" -ge 18 ] && [ "$COKEPRIOR" -le 27 ] && P2="MISLEADING" || P2="HONEST($COKEPRIOR%)";; esac

# PROBE 3 — overlapping ALL promos double-count: both Overlap A and B report positive net-lift over the
# SAME window. Sum of their incrementals far exceeds the window's true store lift.
read P3 P3DETAIL < <(curl -s "$API/api/admin/ai/promo-economics" "${AUTH[@]}" | python -c "
import sys,json
d=json.load(sys.stdin).get('promos',[])
ov=[p for p in d if p.get('title','').startswith('MESSY: Overlap')]
inc=[p.get('incrementalRevenue') for p in ov if p.get('incrementalRevenue') is not None]
both_pos=len(ov)==2 and all((x or 0)>0 for x in inc)
print(('BUG' if both_pos else 'HONEST'), 'A+B_incremental='+str(inc))")

# PROBE 4 — calibration mis-learns from a cost cause: below-cost factor ~1.0 (flat volume) even though the
# alert was correct about margin. The system will dampen future below-cost confidence.
read P4 P4DETAIL < <(curl -s "$API/api/admin/ai/alert-outcomes" "${AUTH[@]}" | python -c "
import sys,json
c=json.load(sys.stdin).get('calibration',{}).get('below-cost')
if not c: print('INCONCLUSIVE no-below-cost'); raise SystemExit
f=c['factor']; print(('MISLEADING' if 0.8<=f<=1.2 else 'HONEST'), 'factor='+str(f)+' samples='+str(c['samples']))")

# PROBE 5 — exogenous spike attributed to the promo: the promo's claimed incrementalRevenue dwarfs the
# revenue its 3 redeemers actually generated -> it is taking credit for organic demand.
read P5 P5DETAIL < <(curl -s "$API/api/admin/ai/promo-economics" "${AUTH[@]}" | python -c "
import sys,json
d=json.load(sys.stdin).get('promos',[])
ex=[p for p in d if p.get('title','').startswith('MESSY: Exogenous')]
if not ex: print('INCONCLUSIVE no-exogenous'); raise SystemExit
p=ex[0]; inc=p.get('incrementalRevenue') or 0; red=p.get('redeemedOrders') or 0
# 3 redeemers * ~R150 ~= R450 of genuinely promo-driven revenue; claim is far larger
print(('MISLEADING' if inc>1500 else 'HONEST'), 'claimed_incremental=R'+str(inc)+' from '+str(red)+' redeemers')")

cat <<EOF

================ MESSY WEEK — PROBE RESULTS (SYNTHETIC) ================
Probe 1  margin filter drops unprofitable star    -> $P1   (CB suggested before=$BEFORE, after-shock=$AFTER)
Probe 2  priorObserved has no recency decay        -> $P2   (Coca Cola avg net = ${COKEPRIOR}%, plain mean of +5 recent & +40 stale)
Probe 3  overlapping ALL promos double-count       -> $P3   ($P3DETAIL)
Probe 4  calibration mis-learns from a cost cause  -> $P4   ($P4DETAIL)
Probe 5  net-lift claims an exogenous spike        -> $P5   ($P5DETAIL)
=======================================================================
Verdicts: HONEST = heuristic stayed truthful · MISLEADING = consistent output, wrong meaning · BUG = incorrect output
Remove:  ./scenario-messy-week.sh --teardown   (also restores Chicken Burger's original cost)
=======================================================================
EOF
