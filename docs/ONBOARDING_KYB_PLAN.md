# Onboarding KYB hardening + VerifyNow integration — PLAN (paused 2026-06-10)

Paused pending a **VerifyNow sandbox key**. The onboarding *security* holes are already fixed +
shipped; what's parked here is turning onboarding from "collect documents + click Approve" into real
KYB (verify the business, the bank account, and screen AML/PEP), plus the code-only validation
hardening.

## Already fixed + shipped (security)
- `a10bb2a` — **[CRITICAL]** cross-tenant takeover via `X-Tenant-Id` header (JWT tenant now
  authoritative; runtime-verified) **+** approval gate: `approvalStatus` defaults to `DRAFT`, orders +
  discovery (`/active`, `/nearby`) now require `APPROVED`, archived stores not served by slug.
- `1c683ca` — self-approve bypass (Spring `PUT /superadmin/tenants` → whitelisted update) +
  activate-unapproved guards on the .NET store edit/toggle.
- (earlier this session) store removal = guarded archive, rejected-enrollments `/rejected`+`/archive`,
  delete-user = POPIA anonymize, enrollment approve/reject emails via Resend.

## VerifyNow — chosen provider (SA: CIPC, bank, AML/PEP, vehicle, FICA/POPIA)
Covers exactly the gaps that need an external provider, and adds FICA-grade AML screening (a legal
obligation for a platform that pays merchants out). Per-check cost at **Starter (R2.99/credit)**:

| Check | Credits | Cost | Use |
|---|---|---|---|
| SAID Verification | 1 | R2.99 | identity (ID number valid) |
| Driver's Licence Authenticate | 3 | R8.97 | driver |
| Number Plate Lookup | 5 | R14.95 | driver vehicle |
| VIN Lookup | 5 | R14.95 | driver vehicle (optional) |
| AML/PEP/Sanctions | 5 | R14.95 | FICA screen |
| Bank Account Verify | 6 | R17.94 | payout account |
| ID + Photo (Standard) | 8 | R23.92 | identity + liveness |
| CIPC Company Match | 10 | R29.90 | business identity |
| CIPC Director Search | 10 | R29.90 | director identity |
| KYC Bundle | 15 | R44.85 | all-in-one identity |

**Bundles (one-time per onboarding):**
- Store — Lean (CIPC Match + Bank + AML) = **21 cr / R62.79**; Full (+ Director Search + owner SAID) =
  **32 cr / R95.68**. Recommend Full for merchants (they're who you pay).
- Driver — Lean (SAID + Licence + Plate) = **9 cr / R26.91**; Standard (ID+Photo + Licence + Plate) =
  16 cr; Full (+ VIN) = 21 cr.

**Tier: START ON STARTER (0–499 credits/mo).** Volume = *new* signups/mo, not total base. Carries
~10 stores + 30 drivers/mo (~480 cr). Launch (5 stores + 15 drivers) ≈ 240 cr ≈ **R718/mo**. Tiers
auto-apply by usage — climb to Starter Plus (R2.84) ~20 stores+60 drivers, Pro (R2.69) at scale.
Drivers are the volume driver (≈3× stores) — keep their bundle lean.

## Integration plan (when sandbox key arrives)
- **Store submit-for-review** → run CIPC Company Match + Bank Account Verify + AML/PEP; persist a
  per-check `verification_result` (pass / fail / needs-review + provider reference) on the tenant;
  block or flag submission on fail.
- **Driver onboarding** → SAID + Driver's Licence Authenticate + Number Plate (+ VIN / ID+Photo
  optional). Store results on the driver/user.
- **SuperAdmin review screen** → show **green/red per check** instead of eyeballing a PDF — this also
  fixes the dead `StoreDocument.status`/`reviewNotes`/`reviewedAt` columns (currently never written).
- **AML/PEP re-screen** active merchants ~quarterly (sanctions lists change). ~+83 cr/mo at 50 stores.
- **Secret handling**: API key in .NET user-secrets locally + a Railway env var in prod (NEVER a repo
  file) — same pattern as `RESEND_API_KEY`.

## Confirm with VerifyNow before wiring
1. **Sandbox / test key** (so dev doesn't burn credits or hit live registries).
2. **Is Bank Account Verify real AVS** (account-holder-name MATCHES the business), not just format/exists?
   The name-match is what actually stops misdirected payouts + mule accounts.
3. API shape: sync vs async/webhook, rate limits, and whether AML returns a hit list to adjudicate.

## Still to do — code-only KYB hardening (no external dep, can start anytime)
- **Document content validation** — file type / size / magic-byte. Today any file (`.exe`, 1-byte) is
  accepted as a "CIPC certificate"; `STOREFRONT_PHOTO` isn't required.
- **Per-document review** — wire the `status`/`reviewNotes`/`reviewedAt` columns + an adjudicate
  endpoint; gate tenant approval on all required docs ACCEPTED (or replace with VerifyNow results).
- **Format + duplicate**: CIPC pattern `YYYY/NNNNNN/NN` + uniqueness, bank branch/account format,
  require `email_verified` for store admins (currently forced `true`), unique email/CIPC constraints
  (migration), rate-limit the public `register` endpoint.
- **#5 payment gate** — the PayFast checkout can still take a customer payment for an unapproved store
  before `/place` rejects it (charged-but-no-order). Low exposure (needs the slug) but real.
- **#14 state guards** — approve/reject/submit currently fire from any state.
- **#16 compliance-doc URL security** — KYB documents (CIPC, COA, BANK_DETAILS) are uploaded to
  Cloudinary as PUBLIC `upload`-type assets (`CloudinaryService.upload` → public `secure_url`), so the
  file is reachable by anyone with the link even though the listing endpoint is ADMIN-gated. Fix:
  upload compliance docs as Cloudinary **authenticated** type + serve via an auth-checked proxy / signed
  URL on the Spring backend (mirror the SuperAdmin `EnrollmentController.DownloadDocument` proxy
  pattern); backfill/migrate existing public docs. Standalone security task — verified 2026-06-13.

## Deferred / non-blocking
- **#15 POPIA at rest** — encrypt or tokenize `bank_account_number` + `cipc_number`; mask in the
  SuperAdmin UI. Returned unmasked to superadmin today; shared DB widens the surface.
- **#13** — Spring `approve` sets `active=true`, .NET `approve` sets `active=false` (the .NET 2-step is
  the intended one); reconcile for consistency.
