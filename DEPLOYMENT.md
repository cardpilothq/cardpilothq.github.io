# CardPilotHQ Deployment (2 Environments Only)

## Environment Model

Only two environments are supported:
- `TEST`: validation and user acceptance, wired to eBay `sandbox`
- `PROD`: live deployment, wired to eBay `production`

## Workflows

### 1) Backend Deploy: `deploy-environments.yml`

- Triggered by push to `test` branch.
- Deploy target is always `TEST`.
- Produces immutable artifact `cardpilot-bundle-<sha>`.
- Runs TEST smoke checks after deploy.

Required secret:
- `TEST_DEPLOY_WEBHOOK_URL`

Optional variable:
- `TEST_BASE_URL` (default fallback is `https://cardpilot-qa.onrender.com`)

### 2) Promotion: `promote-test-to-prod.yml`

- Manual workflow: `Promote TEST Artifact to PROD`
- Input: `test_run_id`
- Verifies the selected run succeeded and had a successful `Deploy TEST` job.
- Promotes the exact TEST artifact to PROD.

Required secret:
- `PROD_DEPLOY_WEBHOOK_URL`

### 3) Frontend Publish: `publish-frontend-environments.yml`

- Push to `test` publishes TEST frontend.
- Push to `main` publishes PROD frontend.
- Uses only `Frontend/` as publish surface.

Required variables:
- `TEST_PAGES_REPO`
- `PROD_PAGES_REPO`
- `TEST_APP_URL`
- `PROD_APP_URL`

Required secret:
- `PAGES_DEPLOY_TOKEN`

## Required GitHub Environments

Create exactly:
- `TEST`
- `PROD`

Recommended:
- Add required reviewers on `PROD`.

## Render and Runtime Variables

### TEST (sandbox)
- `APP_ENV=test`
- `EBAY_ENV=sandbox`

### PROD (production)
- `APP_ENV=prod`
- `EBAY_ENV=production`

## Branch/Promotion Policy

1. Validate all changes in TEST first.
2. Promote only tested artifacts to PROD.
3. No direct PROD deploy from unverified commits.
