import express from 'express'
import multer from 'multer'
import { getUserContextFromToken } from '../services/authService.js'
import {
  upsertSet,
  listSets,
  bulkUpsertChecklist,
  importChecklistFromXlsx,
  importChecklistManifest,
  bulkUpsertImages,
  matchCardImage,
  matchCardByFields,
  listTemplates,
  createTemplate,
  buildListingDraft,
  submitListingDraft,
  initializeCatalogDatabase
} from '../services/cardCatalogService.js'

const router = express.Router()
const upload = multer()

function extractBearerToken(req) {
  const header = String(req.headers.authorization || '').trim()
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim()
  }
  return ''
}

function extractCookieToken(req, cookieName = 'cardpilot_session') {
  const raw = String(req.headers.cookie || '').trim()
  if (!raw) return ''
  const tokenPart = raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(`${cookieName.toLowerCase()}=`))
  if (!tokenPart) return ''
  const [, value = ''] = tokenPart.split('=')
  try {
    return decodeURIComponent(value).trim()
  } catch {
    return String(value || '').trim()
  }
}

function extractSessionToken(req) {
  return extractBearerToken(req) || extractCookieToken(req)
}

async function requireCatalogAuth(req, res, next) {
  try {
    const token = extractSessionToken(req)
    const context = await getUserContextFromToken(token)
    if (!context?.user?.id) {
      res.status(401).json({ ok: false, error: 'Unauthorized', details: 'Sign in is required for catalog operations.' })
      return
    }

    req.auth = context
    next()
  } catch (err) {
    console.error('Catalog auth middleware failed:', err)
    res.status(500).json({ ok: false, error: 'Failed to verify catalog auth.' })
  }
}

router.get('/health', async (req, res) => {
  try {
    await initializeCatalogDatabase()
    res.json({ ok: true, status: 'catalog-ready' })
  } catch (err) {
    console.error('Catalog health failed:', err)
    res.status(500).json({ ok: false, error: 'Catalog initialization failed.' })
  }
})

router.get('/sets', async (req, res) => {
  try {
    const sport = String(req.query?.sport || '').trim()
    const items = await listSets({ sport })
    res.json({ ok: true, items })
  } catch (err) {
    console.error('Catalog list sets failed:', err)
    res.status(500).json({ ok: false, error: 'Failed to list sets.' })
  }
})

router.post('/sets', requireCatalogAuth, async (req, res) => {
  try {
    const set = await upsertSet(req.body || {})
    res.json({ ok: true, set })
  } catch (err) {
    console.error('Catalog upsert set failed:', err)
    res.status(400).json({ ok: false, error: err.message || 'Failed to upsert set.' })
  }
})

router.post('/checklist/bulk', requireCatalogAuth, async (req, res) => {
  try {
    const set = req.body?.set || {}
    const cards = Array.isArray(req.body?.cards) ? req.body.cards : []

    if (!cards.length) {
      res.status(400).json({ ok: false, error: 'cards[] is required.' })
      return
    }

    const result = await bulkUpsertChecklist(set, cards)
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('Catalog checklist ingest failed:', err)
    res.status(400).json({ ok: false, error: err.message || 'Checklist ingest failed.' })
  }
})

router.post('/checklist/import-xlsx', requireCatalogAuth, async (req, res) => {
  try {
    const filePath = String(req.body?.filePath || '').trim()
    if (!filePath) {
      res.status(400).json({ ok: false, error: 'filePath is required.' })
      return
    }

    const result = await importChecklistFromXlsx({
      filePath,
      sheetName: req.body?.sheetName,
      set: req.body?.set
    })

    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('Catalog xlsx import failed:', err)
    res.status(400).json({ ok: false, error: err.message || 'XLSX import failed.' })
  }
})

router.post('/checklist/import-manifest', requireCatalogAuth, async (req, res) => {
  try {
    const manifestPath = String(req.body?.manifestPath || 'data/checklists/downloads/football-checklist-downloads-manifest.json').trim()
    const result = await importChecklistManifest(manifestPath)
    res.json({ ok: true, manifestPath, ...result })
  } catch (err) {
    console.error('Catalog manifest import failed:', err)
    res.status(400).json({ ok: false, error: err.message || 'Manifest import failed.' })
  }
})

router.post('/images/bulk', requireCatalogAuth, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!items.length) {
      res.status(400).json({ ok: false, error: 'items[] is required.' })
      return
    }

    const result = await bulkUpsertImages(items)
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('Catalog image ingest failed:', err)
    res.status(400).json({ ok: false, error: err.message || 'Image ingest failed.' })
  }
})

router.post('/match', upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      res.status(400).json({ ok: false, error: 'image file is required.' })
      return
    }

    const sport = String(req.body?.sport || req.query?.sport || '').trim()
    const result = await matchCardImage(req.file.buffer, { sport })

    const threshold = Number(req.body?.threshold || req.query?.threshold || 0.72)
    const best = result.best
    const accepted = Boolean(best && best.score >= threshold)

    res.json({
      ok: true,
      accepted,
      threshold,
      ...result
    })
  } catch (err) {
    console.error('Catalog match failed:', err)
    res.status(500).json({ ok: false, error: err.message || 'Image match failed.' })
  }
})

router.post('/match-fields', async (req, res) => {
  try {
    const sport = String(req.body?.sport || req.query?.sport || 'Football').trim()
    const result = await matchCardByFields(req.body || {}, { sport })
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('Catalog field match failed:', err)
    res.status(500).json({ ok: false, error: err.message || 'Field matching failed.' })
  }
})

router.get('/templates', async (req, res) => {
  try {
    const items = await listTemplates()
    res.json({ ok: true, items })
  } catch (err) {
    console.error('Catalog templates list failed:', err)
    res.status(500).json({ ok: false, error: 'Failed to list templates.' })
  }
})

router.post('/templates', requireCatalogAuth, async (req, res) => {
  try {
    const template = await createTemplate(req.body || {})
    res.json({ ok: true, template })
  } catch (err) {
    console.error('Catalog create template failed:', err)
    res.status(400).json({ ok: false, error: err.message || 'Failed to create template.' })
  }
})

router.post('/listing-draft', requireCatalogAuth, async (req, res) => {
  try {
    const cardId = String(req.body?.cardId || '')
    const cardIds = req.body?.cardIds
    const cardRef = String(req.body?.cardRef || '')
    const chaseCardId = String(req.body?.chaseCardId || '')
    const chaseCardRef = String(req.body?.chaseCardRef || '')
    const templateId = String(req.body?.templateId || '')

    if (!templateId) {
      res.status(400).json({ ok: false, error: 'templateId is required.' })
      return
    }

    const draft = await buildListingDraft({
      cardId,
      cardIds,
      cardRef,
      chaseCardId,
      chaseCardRef,
      templateId,
      ownerUserId: req.auth.user.id
    })
    res.json({ ok: true, ...draft })
  } catch (err) {
    console.error('Catalog listing draft failed:', err)
    res.status(400).json({ ok: false, error: err.message || 'Failed to build listing draft.' })
  }
})

router.post('/listing-submit', requireCatalogAuth, async (req, res) => {
  try {
    const result = await submitListingDraft({ ...(req.body || {}), ownerUserId: req.auth.user.id })
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('Catalog listing submit failed:', err)
    res.status(400).json({ ok: false, error: err.message || 'Failed to submit listing draft.' })
  }
})

export default router
