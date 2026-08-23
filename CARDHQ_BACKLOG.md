# CardHQ Backlog

## Enhancement Items

1. Pre-scan import panel optimization
- Keep the pre-scan chooser compact on desktop and mobile.
- Keep year defaults focused on 2025 and 2026 for current workflow.
- Expand to multi-year support and dynamic filtering once additional seasons are onboarded.

2. User feedback and defect intake improvements
- Add optional SMTP delivery path for submitted reports.
- Add direct GitHub backlog issue creation with richer templates, labels, and triage metadata.
- Add screenshot/file attachment support for defect submissions.

## Bug Items (DEV Regression 2026-07-01)

### GitHub Issue Status (Updated 2026-07-01)

- Closed as fixed with high-level notes: #5, #6, #7, #8, #9, #10, #11, #12
- Still open with status comments posted: #1 (OAuth callback mapping diagnostics), #2 (owner cleanup/remap utility), #3 (feedback submit GitHub token/config wiring)

1. DEV defect submissions do not create GitHub issues
- Severity: High
- Repro: POST `/feedback/submit` in DEV returns `ok=true` with message `GitHub issue integration is not configured yet.` and empty `issueUrl`.
- Evidence: Generated defect artifacts under `backend/data/reports/feedback/` and response payload with blank `issueUrl`.
- Expected: Defect submission should create a GitHub issue in `cardpilothq/cardpilothq.github.io` and return a non-empty `issueUrl`.
- Likely cause: `FEEDBACK_GITHUB_TOKEN` unset in active DEV environment file.

2. OAuth completion still depends on external eBay RuName callback wiring
- Severity: Medium
- Repro: Users can still land on eBay default `ThirdPartyAuthSucessFailure` page after successful sandbox consent if eBay callback mapping is not aligned to local callback endpoint.
- Expected: OAuth success should always return users to CardPilotHQ profile flow.
- Current mitigation: Added manual `Finish OAuth From URL` fallback in Profile, but external callback config drift can still cause confusion.
- Fix direction: Add startup diagnostics endpoint/UI warning when callback mapping appears misaligned, plus explicit setup validator checklist.

3. No admin utility to remap or purge legacy inventory ownership
- Severity: Medium
- Repro: Signed-in inventory is owner-scoped correctly, but previously imported rows may still exist under prior owner scopes; there is no admin command to remap/clean by owner in one action.
- Expected: DEV should include a safe owner-level maintenance tool (list owners, move rows, purge selected owner scope).
- Impact: Test cycles can appear inconsistent across sessions/accounts and slow QA cleanup.

4. Anonymous inventory bulk writes create ownerless rows
- Severity: Medium
- Repro: POST `/inventory/bulk` without authentication succeeds and can create or update an ownerless inventory row. In DEV regression this produced an anonymous Football row with blank fields and incrementing quantity.
- Expected: Inventory writes should require authentication, or anonymous mode should be explicit and isolated.
- Impact: Logged-out users can accumulate junk inventory data and confuse regression state before sign-in.

5. Anonymous listing draft generation can access signed-in inventory by SKU
- Severity: High
- Repro: POST `/catalog/listing-draft` anonymously with a valid templateId and `cardRef=SKU-000007` returned a complete draft for a signed-in user's inventory card.
- Expected: Listing draft generation should require authentication and only resolve inventory refs within the active owner's scope.
- Impact: Cross-profile data exposure; anonymous callers can derive another user's listing details via SKU references.

6. Anonymous listing submission can queue artifacts from signed-in inventory by SKU
- Severity: High
- Repro: POST `/catalog/listing-submit` anonymously with a valid templateId and `cardRef=SKU-000007` returned a queued submission artifact and wrote a listing submission JSON file.
- Expected: Listing submission should require authentication and only operate on inventory owned by the active user.
- Impact: Cross-profile authorization failure that can generate downstream listing artifacts from another user's inventory references.

7. Anonymous callers can create persistent catalog templates
- Severity: High
- Repro: POST `/catalog/templates` anonymously created template `Regression Anonymous Template` and it persisted in subsequent GET `/catalog/templates` results.
- Expected: Catalog mutation endpoints should require authenticated/admin access.
- Impact: Unauthenticated callers can change shared listing configuration and likely other catalog write surfaces.

8. Anonymous callers can create catalog sets
- Severity: High
- Repro: POST `/catalog/sets` anonymously created set `Anonymous Set Probe` in DEV.
- Expected: Catalog set creation should require authenticated/admin access.
- Impact: Unauthenticated callers can modify shared catalog metadata.

9. Anonymous users can update ownerless inventory rows
- Severity: Medium
- Repro: PUT `/inventory/{id}` anonymously updated ownerless row `cbca3024-c8b8-4092-b723-78c63bcc7f0f` to `quantity=99` and `name=Anonymous Updated Row`.
- Expected: Inventory mutation should require authentication or otherwise protect guest rows from arbitrary edits.
- Impact: Any anonymous caller can tamper with shared ownerless inventory state.

10. Anonymous callers can bulk import checklist cards
- Severity: High
- Repro: POST `/catalog/checklist/bulk` anonymously created set `Anonymous Checklist Set` and inserted checklist card data.
- Expected: Checklist/catalog mutation should require authenticated/admin access.
- Impact: Unauthenticated callers can alter shared checklist/catalog data.

11. Anonymous users can delete ownerless inventory rows
- Severity: Medium
- Repro: DELETE `/inventory/{id}` anonymously deleted ownerless row `cbca3024-c8b8-4092-b723-78c63bcc7f0f` with `deleted=1`.
- Expected: Inventory delete operations should require authentication or protect guest rows from arbitrary deletes.
- Impact: Any unauthenticated caller can destroy shared ownerless inventory state.

12. Anonymous pricing estimate endpoint allowed unauthenticated outbound comp lookups
- Severity: High
- Repro: POST `/inventory/pricing/estimate-batch` without authentication returned `ok=true` and executed outbound pricing lookup attempts.
- Expected: Pricing estimate should require authenticated user context because it is part of inventory-to-listing workflow and can incur external request/cost load.
- Impact: Unauthorized callers could trigger repeated pricing requests, increasing operational cost and noise.
- Fix status (2026-07-02): Patched by enforcing auth middleware on `/inventory/pricing/estimate-batch`; regression coverage added in `backend/scripts/regressionAuthz.mjs` (`unauth_pricing_estimate_rejected`, `auth_pricing_estimate_ok`).

13. QA promotion workflow fails before deployment due invalid secrets expression usage
- Severity: High
- Repro: Push commit `fa83d82` to `qa` triggered Actions run `28598223374` for `.github/workflows/deploy-environments.yml` with annotation `Invalid workflow file ... Unrecognized named-value: 'secrets'`.
- Expected: QA promotion workflow should execute resolve/build/deploy jobs and optionally call webhook when configured.
- Impact: Candidate commit cannot be promoted/deployed to QA, blocking end-to-end QA validation and release progression.
- Fix status (2026-07-02): Updated workflow to map secrets into job env vars and use `env.*` in step `if` expressions for DEV and QA webhook steps.

14. QA deploy job succeeds but skips webhook trigger, leaving QA backend on stale API surface
- Severity: High
- Repro: After workflow fix, Actions run `28598352182` shows `Deploy QA` job success but step `Trigger QA deployment webhook` is `skipped`; QA endpoint `https://cardpilot-qa.onrender.com` still returns legacy responses (`/auth/signup` 404, unauth inventory/catalog writes 200, pricing endpoint 404).
- Expected: QA deployment should invoke webhook and deploy the promoted candidate commit so QA APIs match DEV-validated auth and listing flow behavior.
- Impact: QA validation cannot certify candidate build readiness; release progression is blocked even though pipeline run reports success.
- Fix status (2026-07-02): Added fail-fast gate in `.github/workflows/deploy-environments.yml` so DEV/QA deploy jobs now fail when deploy webhook secret is missing instead of silently skipping rollout.
- Remaining action: Configure `QA_DEPLOY_WEBHOOK_URL` in repository/environment secrets and verify webhook target deploys backend SHA from workflow artifact metadata.

15. QA candidate branch was missing catalog auth middleware hardening for write/listing routes
- Severity: High
- Repro: Clean QA simulation at commit `7b39a10` returned 200 for unauthenticated POST `/catalog/templates`, `/catalog/sets`, `/catalog/checklist/bulk`, `/catalog/listing-draft`, and `/catalog/listing-submit` in `npm run test:authz`.
- Expected: Catalog mutation and listing-draft/submit endpoints should require authenticated user context and owner scoping.
- Impact: Anonymous callers can mutate catalog metadata and generate listing artifacts, blocking QA security readiness.
- Fix status (2026-07-02): Promoted `backend/routes/catalog.js` auth middleware + owner scoping updates in QA commit `4f0be1b`; clean QA simulation now passes `npm run test:authz` (12/12) and `npm run test:e2e:candidate` (10/10).

16. QA webhook-triggered deploy completes but live QA backend remains on stale API surface
- Severity: High
- Repro: QA deploy workflow run `28603175292` shows `Trigger QA deployment webhook` success, but live `https://cardpilot-qa.onrender.com` still returns `404` for `/auth/providers`, `/inventory/pricing/estimate-batch`, and `/catalog/listing-submit` while other legacy routes remain active.
- Expected: After QA webhook deployment, live QA backend should expose auth/profile routes and enforce 401 on protected pricing/listing-submit endpoints.
- Impact: QA cannot be certified ready; promoted candidate commit behavior does not match live QA runtime.
- Fix status (2026-07-02): Added post-webhook QA smoke checks in `.github/workflows/deploy-environments.yml` to assert endpoint contract (`health=200`, `auth/providers=200`, unauth pricing/listing-submit `401`) and fail deployment when stale surface persists.
- Remaining action: Verify Render QA service source repo/branch and deploy hook target are mapped to the candidate backend service expected by this workflow.
