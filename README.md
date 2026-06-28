# CardPilot HQ - Automated Sports Card Inventory Manager

A full-stack web app for scanning, OCR extraction, and cataloging sports trading cards. Built with Node.js + Azure Document Intelligence + vanilla JavaScript.

POC mode is also supported for low-cost CardSight free/trial evaluation without replacing your main QA/PROD flows.

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
- Real-time environment badges ([QA] / [PROD])

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
npm run start:qa

# Frontend (in separate terminal)
# Open http://localhost:3000 or http://localhost:3001
```

### Configure Azure

1. Get your Azure credentials from [Azure Portal](https://portal.azure.com):
   - Cognitive Services → Document Intelligence
   - Copy `Endpoint` and `API Key`

2. Create `.env.qa`:
   ```
   APP_ENV=qa
   AZURE_ENDPOINT=https://your-resource.cognitiveservices.azure.com
   AZURE_API_KEY=your-api-key-here
   AZURE_MODEL_ID=prebuilt-read
   ```

3. Restart backend: `npm run start:qa`

### Configure POC (CardSight Free/Trial)

1. Copy `backend/.env.poc.example` to `backend/.env.poc`
2. Set your trial key:
  - `CARDSIGHT_API_KEY=...`
3. Start POC backend:

```bash
cd backend
npm run start:poc
```

POC settings include hard usage caps and cheap-mode single-pass analyze by default.

## Deployment

**GitHub Pages + Render (free):**

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions.

Quick summary:
1. Push code to GitHub
2. Enable GitHub Pages (frontend at `https://jayzeespc.github.io/card-automation/`)
3. Deploy backend to Render free tier
4. Update `Frontend/config.json` with backend URL
5. Done! ✅

### Side-By-Side POC Deployment (Recommended)

Keep your main site and POC site separate without changing your QA/PROD setup:

1. Prepare POC frontend copy:

```powershell
cd d:\Website\card-automation
setup-poc-frontend.bat
```

2. Publish `Frontend-POC/` as your POC GitHub Pages site.
3. Point the POC frontend to your POC backend via `Frontend-POC/config.json`.
4. Run POC backend with:

```powershell
cd backend
npm run start:poc
```

This gives you a clean split like:
- Main: CardPilot HQ (QA/PROD)
- Trial: CardPilot HQ - POC (CardSight free/trial evaluation)

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

### `.env.qa` (QA/Testing)
```
APP_NAME=CardPilot HQ
APP_ENV=qa
PORT=3000
CORS_ORIGIN=http://localhost:3000
AZURE_ENDPOINT=...
AZURE_API_KEY=...
RATE_LIMIT_MAX_REQUESTS=30
```

### `.env.prod` (Production)
Same structure, with `APP_ENV=prod` and updated `CORS_ORIGIN`

### `.env.poc` (CardSight Trial Evaluation)
Use `AI_PROVIDER=hybrid`, `AI_PRIMARY_PROVIDER=cardsight`, and keep:
- `POC_BUDGET_ENABLED=true`
- `POC_MAX_ANALYZE_CALLS=120`
- `POC_CHEAP_MODE=true`
- `CARDSIGHT_USE_FREE_PREFLIGHT=true`

## Testing

```bash
# Run regression suite
node backend/scripts/runRegressionBatch.mjs

# Start local dev server
npm run start:qa

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
- Ensure backend is running: `npm run start:qa`

**Duplicate rows not merging:**
- Check `scoreDuplicatePair()` scoring thresholds in `Frontend/app.js`
- Verify OCR cache isn't stale: clear `backend/data/cache/azure/`

## License

MIT

## Author

Built by [jayzeespc](https://github.com/jayzeespc)

---

**Ready to deploy?** See [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub Pages + Render setup.
