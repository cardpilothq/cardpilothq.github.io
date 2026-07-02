# CardPilot HQ Operations Manual

Version date: 2026-07-01  
Owners: Engineering, QA, Operations

## 1) Purpose and Scope

This manual defines how CardPilot HQ is operated, validated, promoted, and supported across DEV-POC, QA, and PROD.

It is the system-of-record for:
- Day-to-day operating procedures
- Deployment and promotion controls
- Regression and readiness gates
- Incident response and recovery steps
- Team documentation responsibilities

This manual covers the repository state as of 2026-07-01.

## 2) System Overview

CardPilot HQ is a full-stack sports card operations platform with:
- Frontend: static web app in `Frontend/` (and `Frontend-POC/` for side-by-side POC)
- Backend: Node.js Express API in `backend/`
- AI extraction: Azure Document Intelligence primary flows, optional CardSight/hybrid POC path
- Persistence and artifacts:
  - inventory and operational data managed by backend
  - cached AI responses in `backend/data/cache/azure/`
  - reports in `backend/data/reports/`

Core functions:
- Card image analysis (`POST /analyze`)
- Inventory operations (`/inventory`)
- Catalog and listing workflows (`/catalog/*`)
- Health/config/diagnostics (`/health`, `/config`, `/diagnostics`)

## 3) Environment Model and Promotion Policy

Environment intent:
- DEV-POC: first validation target for all implementation changes
- QA: promotion-only from DEV-validated commits
- PROD: promotion-only from QA-validated artifacts

Mandatory policy:
1. No implementation change is promoted directly to QA or PROD without DEV validation.
2. QA must run on the same promoted commit/artifact that passed DEV.
3. PROD must be promoted from a successful QA artifact run.

## 4) Team Norms (Enforced)

For every implementation change pushed to DEV:
1. Add or update automated coverage (unit and/or regression) for the changed behavior.
2. Verify tests in DEV before promotion.
3. Cross-reference this manual in the change notes/PR.
4. Update this manual when operations behavior, runbooks, commands, architecture, controls, or escalation paths change.

Private operating details such as test users, repository access mappings, environment account ownership, and credential references must be maintained only in internal non-published storage such as a local `internal/` folder or approved secrets vault.

If a DEV push changes runtime behavior and does not include test coverage and Ops Manual review/update, promotion is blocked.

## 5) Roles and Responsibilities

- Engineering
  - Implement scoped fixes/features
  - Add/maintain tests for changed behavior
  - Keep runbooks and this manual current
- QA
  - Execute functional and regression validation in DEV/QA
  - Confirm acceptance criteria and release readiness
- Operations
  - Maintain deployment pathways, environment variables, and service health
  - Lead incident coordination and recovery communication
- Release approver
  - Enforce promotion gates and evidence requirements

## 6) Repository and Runtime Components

Top-level operational assets:
- `README.md`
- `QUICKSTART.md`
- `DEPLOYMENT.md`
- `BUGFIX_WORKFLOW.md`
- `backend/UAT_RUNBOOK.md`

Backend runtime assets:
- `backend/server.js` (main API)
- `backend/process-manager.js` (local manager)
- `backend/routes/` (API routes)
- `backend/services/` (AI, parsing, business logic)
- `backend/scripts/` (regression and utility scripts)

Data and diagnostics:
- `backend/data/cache/azure/` (response cache)
- `backend/data/reports/` (regression/beta reports)
- `backend/logs/` (runtime logs)

## 7) Standard Operating Procedures

### 7.1 Local Startup

From `backend/`:
- QA: `npm run start:qa`
- POC: `npm run start:poc`
- PROD profile: `npm run start:prod`

Local manager options:
- `backend/start-manager.bat`
- `backend/start-manager.ps1`

### 7.2 Health and Configuration Verification

Required checks after startup:
1. `GET /health` returns successful liveness response.
2. `GET /config` confirms expected provider mode.
3. `GET /diagnostics` confirms status, guardrails, and beta readiness metadata.

### 7.3 Core Regression Commands

From `backend/`:
- Authz regression: `npm run test:authz`
- Release-candidate E2E smoke (cost-aware): `npm run test:e2e:candidate`
- Beta gate (informational): `npm run regression:beta`
- Beta gate (CI blocking): `npm run regression:beta:ci`
- Custom batch: `node scripts/runRegressionBatch.mjs "D:/Sport Cards/Scanned from Epson/Football" --limit=20 --gate=beta`

### 7.4 Evidence and Reporting

After regression runs:
1. Capture command output and verdict.
2. Review latest report files in `backend/data/reports/`.
3. Attach evidence to issue/PR/release notes before promotion.

## 8) Deployment and Release Operations

Frontend model:
- Separate Pages targets for DEV/QA/PROD environments.

Current frontend URLs:
- DEV: `https://cardpilothq.github.io/cardpilothq-dev/`
- QA: `https://cardpilothq.github.io/cardpilothq-qa/`
- PROD: `https://cardpilothq.github.io/cardpilothq-prod/`

Current backend URL:
- QA: `https://cardpilot-qa.onrender.com`

Backend model:
- Environment-specific deployment configuration and variables.

Release flow:
1. Implement and validate in DEV-POC.
2. Promote validated commit to QA.
3. Execute QA verification and collect evidence.
4. Promote QA artifact to PROD with approval controls.

Do not bypass this flow for implementation changes.

## 9) Security and Access Guardrails

Operational requirements:
- Mutation endpoints must enforce authenticated user context where required.
- Listing draft/submit flows must resolve references only within active owner scope.
- Pricing estimate workflow endpoint (`POST /inventory/pricing/estimate-batch`) must require authenticated user context.
- Anonymous callers must not create/modify/delete user-owned artifacts.

Secrets management:
- Keep environment secrets in deployment environment settings.
- Never commit secret values into the repository.
- Rotate credentials after exposure risk or provider key changes.

## 10) Monitoring, Logging, and Alerting

Minimum monitoring checks:
1. Health endpoint availability
2. Error rate trends for analysis and mutation routes
3. Rate limit and daily AI usage guardrails
4. Regression gate trend in beta-readiness reports

Operational log sources:
- backend runtime console/service logs
- `backend/logs/`
- JSON reports under `backend/data/reports/`

## 11) Incident Response Runbook

Severity guidance:
- Sev 1: system unavailable, data exposure risk, or unauthorized mutation path
- Sev 2: major feature degradation without data-loss risk
- Sev 3: localized defects/workarounds available

Response steps:
1. Detect and classify severity.
2. Stabilize: stop promotions, contain blast radius, apply temporary controls.
3. Diagnose with logs, diagnostics endpoint, and recent deployment diffs.
4. Fix in DEV first with test coverage.
5. Re-run targeted and regression checks.
6. Promote through QA to PROD per gating policy.
7. Publish post-incident notes with root cause and prevention updates.

## 12) Data and Cost Operations

Cost controls:
- Keep OCR pacing/rate limits active.
- Use cached regression runs for repeated datasets where appropriate.
- Use POC budget controls for trial mode operations.

Artifacts and retention:
- Preserve `beta-readiness-latest.json` plus timestamped readiness reports.
- Retain incident-relevant logs/reports with release evidence.

## 13) Change Management Checklist

Use this checklist for every implementation change:
1. Reproduce or define expected behavior.
2. Add/update test coverage (unit/regression).
3. Implement smallest safe fix/change.
4. Validate in DEV and capture evidence.
5. Review this Ops Manual and update affected sections.
6. Promote to QA only after DEV verification.
7. Promote to PROD only from validated QA artifact.

## 14) Known Operational Risks (As of 2026-07-01)

Current tracked concerns include:
- OAuth callback alignment diagnostics and user clarity
- Feedback-to-GitHub integration configuration completeness
- Owner cleanup/remap utility needs

Refer to `CARDHQ_BACKLOG.md` for current status and issue details.

## 15) Document Governance

This manual must be updated when any of the following changes:
- environment topology or promotion controls
- startup/shutdown commands and operational scripts
- endpoint access/security controls
- incident escalation paths
- regression gates and release criteria

Update protocol:
1. Modify this file in the same PR/commit set as the operational change.
2. Note the section updated in change notes.
3. Keep version date current.

---

Related references:
- `BUGFIX_WORKFLOW.md`
- `DEPLOYMENT.md`
- `backend/UAT_RUNBOOK.md`
- `README.md`