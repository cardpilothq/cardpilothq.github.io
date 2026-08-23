# Quick Start: CardPilotHQ with 2 Environments

This project now uses only:
- `TEST`: eBay `sandbox`
- `PROD`: eBay `production`

## 1. Backend Local Setup (TEST)

```powershell
cd backend
npm install
copy .env.test.example .env.test
npm run start:test
```

Required values in `.env.test`:
- `APP_ENV=test`
- `EBAY_ENV=sandbox`
- `AZURE_ENDPOINT`
- `AZURE_API_KEY`

## 2. Backend Local Setup (PROD)

```powershell
cd backend
copy .env.prod.example .env.prod
npm run start:prod
```

Required values in `.env.prod`:
- `APP_ENV=prod`
- `EBAY_ENV=production`

## 3. GitHub Environments and Secrets

Create GitHub environments:
- `TEST`
- `PROD`

Repository secrets:
- `TEST_DEPLOY_WEBHOOK_URL`
- `PROD_DEPLOY_WEBHOOK_URL`
- `PAGES_DEPLOY_TOKEN`

Repository variables:
- `TEST_BASE_URL`
- `TEST_PAGES_REPO`
- `PROD_PAGES_REPO`
- `TEST_APP_URL`
- `PROD_APP_URL`

## 4. Deployment Flow

1. Push to `test` branch to deploy `TEST`.
2. Run `Promote TEST Artifact to PROD` workflow with `test_run_id` from a successful TEST run.
3. Approve PROD environment gate if required.

## 5. Frontend Config

`Frontend/config.json` should point to your TEST backend for test verification, and PROD backend for production release.
