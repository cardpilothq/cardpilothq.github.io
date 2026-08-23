# CardPilot HQ - Automated Sports Card Inventory Manager

Internal-only HTML docs, architecture notes, and access inventories should be kept in a local `internal/` folder and must never be published from `Frontend/` or `Frontend-POC/`.

A full-stack web app for scanning, OCR extraction, and cataloging sports trading cards. Built with Node.js + Azure Document Intelligence + vanilla JavaScript.

Environment model is intentionally simplified to only TEST and PROD.

## Features

✨ **AI-Powered OCR**
- Extract card details (player, team, set, year, condition) from images using Azure Document Intelligence
- Automatic duplicate detection and merging
- Front/back card pair analysis

📊 **Inventory Management**
- SQLite database persistence
- SKU auto-numbering (SKU-000001, etc.)
- Bulk import with conflict resolution
- eBay listing export

🎯 **Rate Limiting & Reliability**
- Client-side OCR pacing (1 request per 2.5 sec, 30 req/min cap)
- Server-side rate limiting and daily quotas
- 8-attempt exponential backoff retry
- Progressive error recovery

📱 **PWA Support**
- Home screen install
- Offline-capable with IndexedDB draft storage
- Real-time environment badges ([TEST] / [PROD])

## Quick Start (Local)

### Prerequisites
- Node.js 20+
- Azure Document Intelligence credentials (free tier available)
- Optional: SQLite browser for data inspection

### Install & Run

```bash
# Backend
cd backend
npm install
npm run start:test

# Frontend (in separate terminal)
# Open http://localhost:3000 or http://localhost:3001
```

### Configure Azure

1. Get your Azure credentials from [Azure Portal](https://portal.azure.com):
   - Cognitive Services → Document Intelligence
   - Copy `Endpoint` and `API Key`

2. Create `.env.test`:
   ```
  APP_ENV=test
   AZURE_ENDPOINT=https://your-resource.cognitiveservices.azure.com
   AZURE_API_KEY=your-api-key-here
   AZURE_MODEL_ID=prebuilt-read
   ```

3. Restart backend: `npm run start:test`

## Deployment

**GitHub Pages + Render (free):**

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions.
See [internal/OPS_MANUAL.html](internal/OPS_MANUAL.html) for full operations standards, release gates, and incident/process runbooks.

Quick summary:
1. Push code to GitHub
2. Create two Pages repos (`cardpilothq-test`, `cardpilothq-prod`)
3. Configure `publish-frontend-environments.yml` variables/secrets in this repo
4. Deploy backend to Render free tier per environment
5. Update `Frontend/config.json` backend URLs per target
5. Done! ✅

Rule: All implementation changes must be validated in `TEST` first. Do not deploy directly to `PROD` before TEST verification is complete.

Team norm for every TEST push: add or update automated test coverage for changed behavior and review/update [internal/OPS_MANUAL.html](internal/OPS_MANUAL.html) when operational behavior is affected.

Frontend URL pattern:
- TEST: `https://<owner>.github.io/cardpilothq-test/`
- PROD: `https://<owner>.github.io/cardpilothq-prod/`

Operational environment and secret requirements live in [internal/OPS_MANUAL.html](internal/OPS_MANUAL.html).



## Project Structure

```
backend/
  ├── server.js              # Express app + middleware
  ├── routes/                # /analyze, /inventory, /catalog, etc.
  ├── services/              # Azure client, card analyzer, duplicate scorer
  ├── data/
  │   ├── cache/azure/       # Persistent OCR cache
  │   ├── checklists/        # Import templates
  │   └── reports/           # Analysis reports (JSON)
  └── package.json

Frontend/
  ├── app.js                 # Main client logic (~3000 lines)
  ├── index.html             # DOM structure
  ├── config.json            # Backend URL config (for GitHub Pages)
  ├── manifest.webmanifest   # PWA metadata
  └── styles.css
```

## Key APIs

### Frontend → Backend

- `POST /analyze` - OCR extract card image
- `POST /inventory/bulk` - Import cards (merge with existing)
- `GET /inventory?sport=Football` - Fetch inventory
- `GET /config` - Environment metadata
- `GET /catalog/sets?sport=Football` - Available sets
- `GET /health` - Health check

### Rate Limiting

- **Frontend:** 1 concurrent OCR worker, 2.5s minimum interval
- **Server:** 30 requests / 60 second sliding window
- **Daily:** 500 Azure calls/day (configurable)

## Environment Variables

### `.env.test` (TEST)
```
APP_NAME=CardPilot HQ
APP_ENV=test
PORT=3000
CORS_ORIGIN=http://localhost:3000
AZURE_ENDPOINT=...
AZURE_API_KEY=...
RATE_LIMIT_MAX_REQUESTS=30
```

### `.env.prod` (Production)
Same structure, with `APP_ENV=prod` and updated `CORS_ORIGIN`

- `CARDSIGHT_USE_FREE_PREFLIGHT=true`

## Testing

```bash
# Run regression suite
node backend/scripts/runRegressionBatch.mjs

# Start local dev server
npm run start:test

# Check diagnostics
curl http://localhost:3000/diagnostics | jq
```

## Troubleshooting

**"Rate limit 429" errors:**
- Ensure frontend has `OCR_MIN_INTERVAL_MS = 2500`
- Check server logs for `Rate limit exceeded`
- Verify `RATE_LIMIT_MAX_REQUESTS=30` in .env

**"Backend not found":**
- Verify health endpoint: `curl http://localhost:3000/health`
- Check CORS_ORIGIN matches your frontend URL
- Ensure backend is running: `npm run start:test`

**Duplicate rows not merging:**
- Check `scoreDuplicatePair()` scoring thresholds in `Frontend/app.js`
- Verify OCR cache isn't stale: clear `backend/data/cache/azure/`

## License

MIT

## Author

Built by [jayzeespc](https://github.com/jayzeespc)

---

**Ready to deploy?** See [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub Pages + Render setup.
