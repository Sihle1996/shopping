#!/usr/bin/env bash
#
# seed-training-data.sh — SYNTHETIC intelligence QA harness for CraveIt (Test Kitchen tenant).
#
# Populates the LOCAL dev database with tagged, fully-removable fake history so the
# data-driven dashboards can be exercised today instead of waiting weeks for real orders:
#   - Driver recommendation feedback (accepted-leg < overridden-leg)
#   - On-time EWMA + daily score snapshots + fleet insights / load share
#   - Promo Net-Revenue-Lift in all three states: POSITIVE / NEGATIVE / INCONCLUSIVE
#
# THIS IS FAKE DATA. It tests the machinery, not real-world truth. Never use the numbers
# to make real decisions; never run against a real/prod database. Everything is tagged
# (orders delivery_address='TRAINSEED', promos title LIKE 'SEED:%') so --teardown removes it.
#
# Usage:
#   PGPASSWORD=... ./seed-training-data.sh --i-understand-this-is-synthetic
#   PGPASSWORD=... ./seed-training-data.sh --teardown
# Connection via standard PG env vars (defaults: localhost:5433/ecommerce as postgres).
set -euo pipefail

export PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5433}" PGUSER="${PGUSER:-postgres}" PGDATABASE="${PGDATABASE:-ecommerce}"

MODE=seed; ACK=0
for a in "$@"; do
  case "$a" in
    --teardown) MODE=teardown;;
    --i-understand-this-is-synthetic) ACK=1;;
    *) echo "unknown arg: $a"; exit 2;;
  esac
done

# --- guards: local-only + explicit acknowledgement ---
case "$PGHOST" in
  localhost|127.0.0.1) ;;
  *) echo "REFUSING: PGHOST='$PGHOST' is not local. This seeds SYNTHETIC data and must never touch a real/prod DB."; exit 1;;
esac
[ -n "${PGPASSWORD:-}" ] || { echo "Set PGPASSWORD (your local DB password) before running."; exit 1; }

PSQL="psql -v ON_ERROR_STOP=1 -tA"

# --- resolve ids by stable keys (survive UUID changes on DB reset) ---
TK=$($PSQL -c "SELECT id FROM tenants WHERE slug='test-kitchen'")
[ -n "$TK" ] || { echo "Test Kitchen tenant (slug=test-kitchen) not found — run the app's normal seed first."; exit 1; }
CUST=$($PSQL -c "SELECT id FROM _user WHERE email='testuser2@example.com' LIMIT 1")
JOHN=$($PSQL -c "SELECT id FROM _user WHERE full_name='John Dube'   AND tenant_id='$TK' LIMIT 1")
MIKE=$($PSQL -c "SELECT id FROM _user WHERE full_name='Mike Naidoo' AND tenant_id='$TK' LIMIT 1")
SARAH=$($PSQL -c "SELECT id FROM _user WHERE full_name='Sarah Botha' AND tenant_id='$TK' LIMIT 1")
[ -n "$CUST" ] && [ -n "$JOHN" ] && [ -n "$MIKE" ] && [ -n "$SARAH" ] || { echo "Expected demo users (testuser2 + drivers John/Mike/Sarah) not found."; exit 1; }

teardown() {
  $PSQL >/dev/null <<SQL
DELETE FROM recommendation_decision WHERE order_id IN (SELECT id FROM orders WHERE delivery_address='TRAINSEED');
DELETE FROM order_item WHERE order_id IN (SELECT id FROM orders WHERE delivery_address='TRAINSEED');
DELETE FROM orders WHERE delivery_address='TRAINSEED';
DELETE FROM promotions WHERE title LIKE 'SEED:%';
DELETE FROM driver_score_snapshot WHERE driver_id IN ('$JOHN','$MIKE','$SARAH');
SQL
  local o p
  o=$($PSQL -c "SELECT count(*) FROM orders WHERE delivery_address='TRAINSEED'")
  p=$($PSQL -c "SELECT count(*) FROM promotions WHERE title LIKE 'SEED:%'")
  [ "$o" = "0" ] && [ "$p" = "0" ] || { echo "TEARDOWN FAILED — residue: orders=$o promos=$p"; exit 1; }
}

if [ "$MODE" = teardown ]; then
  teardown
  echo "Teardown OK — 0 TRAINSEED orders, 0 SEED: promos remain."
  exit 0
fi

[ "$ACK" = 1 ] || { echo "Refusing to seed without --i-understand-this-is-synthetic (this inserts FAKE data)."; exit 1; }
teardown >/dev/null   # idempotent re-run

# General driver orders are seeded everywhere EXCEPT a quiet gap [12d, 5d ago]; the NEGATIVE promo
# runs inside that gap so the store genuinely under-earns vs baseline (a negative can't be faked by
# adding redeemers — their spend only inflates "during" revenue).
$PSQL >/dev/null <<SQL
-- Drivers: vehicle type + on-time EWMA + sample counts
UPDATE _user SET vehicle_type='car',       delivery_score_ewma=0.92, delivery_score_samples=48 WHERE id='$JOHN';
UPDATE _user SET vehicle_type='motorbike', delivery_score_ewma=0.70, delivery_score_samples=33 WHERE id='$MIKE';
UPDATE _user SET vehicle_type='car',       delivery_score_ewma=0.80, delivery_score_samples=30 WHERE id='$SARAH';

-- 30-day daily score snapshots (trends): John improving, Mike declining, Sarah steady
INSERT INTO driver_score_snapshot (id,tenant_id,driver_id,on_time_rate,samples,snapshot_date,created_at)
SELECT gen_random_uuid(),'$TK','$JOHN', 85+round((29-g)/29.0*7), 10+(29-g), (now()-make_interval(days=>g))::date, now()-make_interval(days=>g) FROM generate_series(0,29) g;
INSERT INTO driver_score_snapshot (id,tenant_id,driver_id,on_time_rate,samples,snapshot_date,created_at)
SELECT gen_random_uuid(),'$TK','$MIKE', 78-round((29-g)/29.0*8), 8+(29-g), (now()-make_interval(days=>g))::date, now()-make_interval(days=>g) FROM generate_series(0,29) g;
INSERT INTO driver_score_snapshot (id,tenant_id,driver_id,on_time_rate,samples,snapshot_date,created_at)
SELECT gen_random_uuid(),'$TK','$SARAH', 80+round(sin(g/4.0)*3), 7+(29-g), (now()-make_interval(days=>g))::date, now()-make_interval(days=>g) FROM generate_series(0,29) g;

-- Historical Delivered orders (last 30d, avoiding the [12d,5d] gap). days-ago in [0,5) U [12,30).
WITH g AS (SELECT gen_random_uuid() id, now()-make_interval(days=>(CASE WHEN random()<0.25 THEN random()*5 ELSE 12+random()*18 END)::int, hours=>(random()*12)::int) od, (12+random()*8)::int leg FROM generate_series(1,50))
INSERT INTO orders (id,user_id,tenant_id,driver_id,total_amount,order_date,out_for_delivery_at,delivered_at,status,delivered_by,otp_verified,is_group_order,delivery_address)
SELECT g.id,'$CUST','$TK','$JOHN',(100+random()*200)::int,g.od,g.od+interval '18 min',g.od+interval '18 min'+make_interval(mins=>g.leg),'Delivered','DRIVER_OTP',false,false,'TRAINSEED' FROM g;
WITH g AS (SELECT gen_random_uuid() id, now()-make_interval(days=>(CASE WHEN random()<0.25 THEN random()*5 ELSE 12+random()*18 END)::int, hours=>(random()*12)::int) od, (22+random()*10)::int leg FROM generate_series(1,30))
INSERT INTO orders (id,user_id,tenant_id,driver_id,total_amount,order_date,out_for_delivery_at,delivered_at,status,delivered_by,otp_verified,is_group_order,delivery_address)
SELECT g.id,'$CUST','$TK','$MIKE',(100+random()*200)::int,g.od,g.od+interval '18 min',g.od+interval '18 min'+make_interval(mins=>g.leg),'Delivered','DRIVER_OTP',false,false,'TRAINSEED' FROM g;
WITH g AS (SELECT gen_random_uuid() id, now()-make_interval(days=>(CASE WHEN random()<0.25 THEN random()*5 ELSE 12+random()*18 END)::int, hours=>(random()*12)::int) od, (16+random()*10)::int leg FROM generate_series(1,20))
INSERT INTO orders (id,user_id,tenant_id,driver_id,total_amount,order_date,out_for_delivery_at,delivered_at,status,delivered_by,otp_verified,is_group_order,delivery_address)
SELECT g.id,'$CUST','$TK','$SARAH',(100+random()*200)::int,g.od,g.od+interval '18 min',g.od+interval '18 min'+make_interval(mins=>g.leg),'Delivered','DRIVER_OTP',false,false,'TRAINSEED' FROM g;

-- Recommendation decisions: 1 per driver-seed order (recommended=John; accepted = took John).
INSERT INTO recommendation_decision (id,tenant_id,order_id,recommended_driver_id,recommendation_score,assigned_driver_id,accepted,driver_leg_minutes,on_time,created_at,delivered_at)
SELECT gen_random_uuid(),'$TK',o.id,'$JOHN',round((0.72+random()*0.23)::numeric,2),o.driver_id,(o.driver_id='$JOHN'),
       round(EXTRACT(EPOCH FROM (o.delivered_at-o.out_for_delivery_at))/60),
       (EXTRACT(EPOCH FROM (o.delivered_at-o.out_for_delivery_at))/60)<=45,
       o.order_date,o.delivered_at
FROM orders o WHERE o.delivery_address='TRAINSEED' AND o.driver_id IS NOT NULL AND o.out_for_delivery_at IS NOT NULL;

-- Promos (ALL-scope) for the three net-lift states
INSERT INTO promotions (id,title,start_at,end_at,applies_to,active,featured,promo_type,min_spend,discount_amount,tenant_id) VALUES
  (gen_random_uuid(),'SEED: Free Delivery', now()-interval '5 days',  now()+interval '1 day','ALL',true,false,'FREE_DELIVERY',0,NULL,'$TK'),
  (gen_random_uuid(),'SEED: R30 Off',       now()-interval '12 days', now()-interval '5 days','ALL',false,false,'AMOUNT_OFF',0,30,'$TK'),
  (gen_random_uuid(),'SEED: Thin Baseline', now()-interval '60 days', now()+interval '1 day','ALL',true,false,'FREE_DELIVERY',0,NULL,'$TK');

-- POSITIVE: 20 high-value redeemers in [0,5d] -> during >> baseline projection
INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address,promo_id,promo_type,waived_delivery_fee,promo_funded_by,promo_code)
SELECT gen_random_uuid(),'$CUST','$TK',250, now()-make_interval(days=>(random()*5)::int,hours=>(random()*12)::int),'Delivered',false,false,'TRAINSEED',
       (SELECT id FROM promotions WHERE title='SEED: Free Delivery'),'FREE_DELIVERY',30,'PLATFORM','SEED: Free Delivery' FROM generate_series(1,20);

-- NEGATIVE: 6 low redeemers inside the quiet gap [12d,5d] -> sparse "during" vs dense baseline, plus cost
INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address,promo_id,promo_type,discount_amount,promo_funded_by,promo_code)
SELECT gen_random_uuid(),'$CUST','$TK',90, now()-make_interval(days=>(5+random()*7)::int,hours=>(random()*12)::int),'Delivered',false,false,'TRAINSEED',
       (SELECT id FROM promotions WHERE title='SEED: R30 Off'),'AMOUNT_OFF',30,'STORE','SEED: R30 Off' FROM generate_series(1,6);

-- INCONCLUSIVE: a few redeemers; promo started 60d ago so its 14-day baseline window is empty (<10)
INSERT INTO orders (id,user_id,tenant_id,total_amount,order_date,status,otp_verified,is_group_order,delivery_address,promo_id,promo_type,waived_delivery_fee,promo_funded_by,promo_code)
SELECT gen_random_uuid(),'$CUST','$TK',150, now()-make_interval(days=>(random()*4)::int,hours=>(random()*12)::int),'Delivered',false,false,'TRAINSEED',
       (SELECT id FROM promotions WHERE title='SEED: Thin Baseline'),'FREE_DELIVERY',30,'PLATFORM','SEED: Thin Baseline' FROM generate_series(1,4);
SQL

ORDERS=$($PSQL -c "SELECT count(*) FROM orders WHERE delivery_address='TRAINSEED'")
DECS=$($PSQL -c "SELECT count(*) FROM recommendation_decision rd JOIN orders o ON o.id=rd.order_id WHERE o.delivery_address='TRAINSEED'")
ACC=$($PSQL -c "SELECT count(*) FROM recommendation_decision rd JOIN orders o ON o.id=rd.order_id WHERE o.delivery_address='TRAINSEED' AND rd.accepted")

cat <<EOF

================ TRAINING DATA SEEDED (SYNTHETIC — Test Kitchen) ================
Drivers
  Delivered orders : $ORDERS
  Recommendations  : $DECS  (accepted=$ACC)
  Expected         : acceptance ~50%, accepted legs < overridden legs
Promos (Net Revenue Lift)
  SEED: Free Delivery  -> POSITIVE      (running, redeemer bump)
  SEED: R30 Off        -> NEGATIVE      (ended 5d ago, ran in a quiet revenue gap + cost)
  SEED: Thin Baseline  -> INCONCLUSIVE  (60d old -> empty baseline -> estimate withheld, cost shown)
Verify
  curl .../api/admin/ai/recommendation-stats   # acceptance + accepted-vs-overridden legs
  curl .../api/admin/ai/driver-insights        # scorecard + load share
  curl .../api/admin/ai/promo-economics        # the 3 verdicts
Remove
  ./seed-training-data.sh --teardown
================================================================================
EOF
