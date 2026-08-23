# CardPilot HQ Backend

## Environment Modes

Only two environments are supported:
- `TEST`: validation/testing, eBay `sandbox`
- `PROD`: production, eBay `production`

## Start Commands

```powershell
npm start
npm run start:test
npm run start:prod
```

## Env Files

- `backend/.env.test.example`
- `backend/.env.prod.example`

### TEST setup

1. Copy `backend/.env.test.example` to `backend/.env.test`.
2. Fill required keys.
3. Start with `npm run start:test`.

### PROD setup

1. Copy `backend/.env.prod.example` to `backend/.env.prod`.
2. Fill required keys.
3. Start with `npm run start:prod`.

## eBay Mapping

- `APP_ENV=test` resolves to eBay `sandbox` by default.
- `APP_ENV=prod` resolves to eBay `production` by default.
- `EBAY_ENV` can explicitly be set to `sandbox` or `production` if needed.

## Storage Isolation

Environment-local storage defaults to:
- `data/environments/test/`
- `data/environments/prod/`

## Notes

Operational policies and runbooks remain in `internal/OPS_MANUAL.html`.
