import express from 'express'
import { randomUUID } from 'crypto'
import sqlite3 from 'sqlite3'
import fs from 'fs/promises'
import path from 'path'
import axios from 'axios'
import { getUserContextFromToken } from '../services/authService.js'

const router = express.Router()
const dataDir = path.join(process.cwd(), 'data')
const sqlitePath = path.join(dataDir, 'inventory.db')
const legacyJsonPath = path.join(dataDir, 'inventory.json')
const PRICING_CACHE_TTL_MS = 1000 * 60 * 60 * 12 // 12 hours
const pricingEstimateCache = new Map()
const EBAY_APP_ID = String(process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID || '').trim()

let db = null
let initPromise = null

const EBAY_TEMPLATE_COLUMNS = [
  '*Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)',
  'CustomLabel', '*Category', 'StoreCategory', '*Title', 'Subtitle', 'Relationship', 'RelationshipDetails', 'ScheduleTime',
  '*ConditionID', 'CD:Professional Grader - (ID: 27501)', 'CD:Grade - (ID: 27502)', 'CDA:Certification Number - (ID: 27503)',
  'CD:Card Condition - (ID: 40001)', '*C:Sport', 'C:Player/Athlete', 'C:Season', 'C:Year Manufactured', 'C:Manufacturer',
  'C:Signed By', 'C:Parallel/Variety', 'C:Features', 'C:Set', 'C:Team', 'C:League', 'C:Autographed', 'C:Card Name',
  'C:Card Number', 'C:Type', 'C:Autograph Authentication', 'C:Grade', 'C:Card Size', 'C:Country of Origin', 'C:Graded',
  'C:Professional Grader', 'C:Material', 'C:Autograph Format', 'C:Card Condition', 'C:Vintage', 'C:Event/Tournament',
  'C:Language', 'C:Original/Licensed Reprint', 'C:Certification Number', 'C:Autograph Authentication Number',
  'C:California Prop 65 Warning', 'C:Card Thickness', 'C:Customized', 'C:Insert Set', 'C:Print Run', 'C:Number of Cards',
  'PicURL', 'GalleryType', 'VideoID', '*Description', '*Format', '*Duration', '*StartPrice', 'BuyItNowPrice',
  'BestOfferEnabled', 'BestOfferAutoAcceptPrice', 'MinimumBestOfferPrice', '*Quantity', 'ImmediatePayRequired', '*Location',
  'ShippingType', 'ShippingService-1:Option', 'ShippingService-1:Cost', 'ShippingService-2:Option', 'ShippingService-2:Cost',
  '*DispatchTimeMax', 'PromotionalShippingDiscount', 'ShippingDiscountProfileID', '*ReturnsAcceptedOption', 'ReturnsWithinOption',
  'RefundOption', 'ShippingCostPaidByOption', 'AdditionalDetails', 'ShippingProfileName', 'ReturnProfileName',
  'PaymentProfileName', 'Product Safety Pictograms', 'Product Safety Statements', 'Product Safety Component',
  'Regulatory Document Ids', 'Manufacturer Name', 'Manufacturer AddressLine1', 'Manufacturer AddressLine2', 'Manufacturer City',
  'Manufacturer Country', 'Manufacturer PostalCode', 'Manufacturer StateOrProvince', 'Manufacturer Phone', 'Manufacturer Email',
  'Manufacturer ContactURL', 'Responsible Person 1', 'Responsible Person 1 Type', 'Responsible Person 1 AddressLine1',
  'Responsible Person 1 AddressLine2', 'Responsible Person 1 City', 'Responsible Person 1 Country',
  'Responsible Person 1 PostalCode', 'Responsible Person 1 StateOrProvince', 'Responsible Person 1 Phone',
  'Responsible Person 1 Email', 'Responsible Person 1 ContactURL'
]

const EBAY_REQUIRED_COLUMNS = EBAY_TEMPLATE_COLUMNS.filter((column) => column.startsWith('*'))

const EBAY_COLUMN_SOURCES = {
  '*Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)': 'default(Add)',
  'CustomLabel': 'inventory.sku',
  '*Category': 'default(categoryId)',
  '*Title': 'inventory.title fallback',
  '*ConditionID': 'default(4000)',
  '*C:Sport': 'inventory.sport',
  'C:Player/Athlete': 'inventory.name',
  'C:Year Manufactured': 'inventory.year',
  'C:Parallel/Variety': 'inventory.parallel',
  'C:Set': 'inventory.setName',
  'C:Team': 'inventory.team',
  'C:Autographed': 'inventory.autograph',
  'C:Card Name': 'inventory.name',
  'C:Card Number': 'inventory.cardNumber',
  'C:Type': 'default(Sports Trading Card)',
  'PicURL': 'inventory.pictureUrl',
  '*Description': 'inventory.description fallback',
  '*Format': 'default(FixedPrice)',
  '*Duration': 'default(GTC)',
  '*StartPrice': 'default(startPrice)',
  '*Quantity': 'inventory.quantity',
  '*Location': 'default(location)',
  'ShippingType': 'default(Flat)',
  'ShippingService-1:Option': 'default(shipping service)',
  'ShippingService-1:Cost': 'default(shipping cost)',
  '*DispatchTimeMax': 'default(dispatch)',
  '*ReturnsAcceptedOption': 'default(ReturnsAccepted)',
  'ReturnsWithinOption': 'default(Days_30)',
  'RefundOption': 'default(MoneyBack)',
  'ShippingCostPaidByOption': 'default(Buyer)'
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(sqlitePath, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function extractBearerToken(req) {
  const header = String(req.headers.authorization || '').trim()
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim()
  }
  return ''
}

async function resolveInventoryOwnerUserId(req) {
  const token = extractBearerToken(req)
  if (!token) return null
  try {
    const context = await getUserContextFromToken(token)
    return String(context?.user?.id || '').trim() || null
  } catch (err) {
    console.warn('Could not resolve inventory auth context:', err?.message || err)
    return null
  }
}

function ownerWhereClause(ownerUserId) {
  return ownerUserId
    ? { clause: 'ownerUserId = ?', params: [ownerUserId] }
    : { clause: 'ownerUserId IS NULL', params: [] }
}

async function readLegacyJsonRecords() {
  try {
    await fs.access(legacyJsonPath)
  } catch {
    return []
  }

  try {
    const raw = await fs.readFile(legacyJsonPath, 'utf8')
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn('Could not parse legacy inventory JSON for migration:', err)
    return []
  }
}

async function initializeDatabase() {
  if (initPromise) return initPromise

  initPromise = (async () => {
    await fs.mkdir(dataDir, { recursive: true })
    await openDatabase()

    await dbRun('PRAGMA journal_mode = WAL')
    await dbRun('PRAGMA synchronous = NORMAL')

    await dbRun(`
      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        ownerUserId TEXT,
        sport TEXT NOT NULL,
        sportNormalized TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        pairType TEXT,
        sku TEXT,
        name TEXT,
        team TEXT,
        position TEXT,
        setName TEXT,
        year TEXT,
        cardNumber TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        parallel TEXT,
        rookie TEXT,
        autograph TEXT,
        title TEXT,
        description TEXT,
        pickFrom TEXT,
        filename TEXT,
        pictureUrl TEXT,
        lastImportAttemptId TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `)

    try {
      await dbRun('ALTER TABLE inventory ADD COLUMN ownerUserId TEXT')
    } catch {
      // Column already exists.
    }

    await dbRun('CREATE INDEX IF NOT EXISTS idx_inventory_sport ON inventory (sportNormalized)')
    await dbRun('CREATE INDEX IF NOT EXISTS idx_inventory_owner ON inventory (ownerUserId)')
    await dbRun('DROP INDEX IF EXISTS idx_inventory_fingerprint')
    await dbRun("CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_owner_fingerprint ON inventory (ifnull(ownerUserId, ''), fingerprint)")

    const row = await dbGet('SELECT COUNT(1) AS count FROM inventory')
    const existingCount = Number(row?.count || 0)
    if (existingCount > 0) return

    const legacyRecords = await readLegacyJsonRecords()
    if (!legacyRecords.length) return

    await dbRun('BEGIN')
    try {
      for (const legacy of legacyRecords) {
        const migrated = toRecord(legacy, String(legacy?.sport || 'Football').trim() || 'Football', legacy?.lastImportAttemptId || null)
        migrated.id = String(legacy?.id || migrated.id)
        migrated.createdAt = String(legacy?.createdAt || migrated.createdAt)
        migrated.updatedAt = String(legacy?.updatedAt || migrated.updatedAt)
        await insertInventoryRow(migrated)
      }
      await dbRun('COMMIT')
      console.log(`Migrated ${legacyRecords.length} inventory records from JSON to SQLite.`)
    } catch (err) {
      await dbRun('ROLLBACK')
      console.error('Legacy inventory migration failed:', err)
    }
  })()

  return initPromise
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function pricingFingerprint(item) {
  return [
    normalize(item?.sport),
    normalize(item?.name),
    normalize(item?.team),
    normalize(item?.set),
    normalize(item?.year),
    normalize(item?.cardNumber),
    normalize(item?.parallel)
  ].join('|')
}

function buildMarketQuery(item) {
  const parts = [
    item?.year,
    item?.set,
    item?.name,
    item?.cardNumber ? `#${item.cardNumber}` : '',
    item?.parallel,
    item?.team
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  return parts.join(' ')
}

function buildMarketLinks(query) {
  const encoded = encodeURIComponent(String(query || '').trim())
  return {
    ebaySold: `https://www.ebay.com/sch/i.html?_nkw=${encoded}&LH_Sold=1&LH_Complete=1`,
    oneThirtyPoint: `https://www.google.com/search?q=${encodeURIComponent(`site:130point.com/sales ${String(query || '').trim()}`)}`,
    priceCharting: `https://www.pricecharting.com/search-products?type=prices&q=${encoded}`,
    photoAppraiser: 'https://www.pricecharting.com/photo-appraiser'
  }
}

function extractSoldPricesFromHtml(html) {
  const values = []
  const text = String(html || '')

  const spanRegex = /<span[^>]*class="[^"]*s-item__price[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
  let match
  while ((match = spanRegex.exec(text)) !== null) {
    const cleaned = String(match[1] || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').trim()
    const numMatch = cleaned.match(/\$\s*([0-9,]+(?:\.[0-9]{2})?)/)
    if (!numMatch) continue
    const parsed = Number(String(numMatch[1]).replace(/,/g, ''))
    if (Number.isFinite(parsed) && parsed > 0) values.push(parsed)
    if (values.length >= 24) break
  }

  if (values.length >= 3) return values

  const genericRegex = /\$\s*([0-9,]+(?:\.[0-9]{2})?)/g
  while ((match = genericRegex.exec(text)) !== null) {
    const parsed = Number(String(match[1]).replace(/,/g, ''))
    if (!Number.isFinite(parsed)) continue
    if (parsed <= 0 || parsed > 25000) continue
    values.push(parsed)
    if (values.length >= 24) break
  }

  return values
}

function summarizePrices(prices) {
  const clean = Array.isArray(prices)
    ? prices.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
    : []
  if (!clean.length) return { count: 0, median: null, avg: null, min: null, max: null }

  const count = clean.length
  const mid = Math.floor(count / 2)
  const median = count % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid]
  const sum = clean.reduce((acc, n) => acc + n, 0)
  const avg = sum / count
  return {
    count,
    median,
    avg,
    min: clean[0],
    max: clean[count - 1]
  }
}

function extractEbayApiPrices(payload) {
  const root = payload?.findCompletedItemsResponse?.[0]
  const resultSet = root?.searchResult?.[0]
  const items = Array.isArray(resultSet?.item) ? resultSet.item : []

  const prices = []
  items.forEach((item) => {
    const sellingStatus = item?.sellingStatus?.[0]
    const priceNode = sellingStatus?.convertedCurrentPrice?.[0] || sellingStatus?.currentPrice?.[0]
    const raw = priceNode?.__value__
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) prices.push(n)
  })

  return prices
}

async function estimateFromEbayFindingApi(query) {
  if (!EBAY_APP_ID) {
    throw new Error('EBAY_APP_ID not configured')
  }

  const url = 'https://svcs.ebay.com/services/search/FindingService/v1'
  const params = {
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.13.0',
    'SECURITY-APPNAME': EBAY_APP_ID,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': 'true',
    keywords: query,
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '24'
  }

  const res = await axios.get(url, {
    timeout: 15000,
    params,
    headers: {
      'X-EBAY-SOA-SECURITY-APPNAME': EBAY_APP_ID
    }
  })

  const prices = extractEbayApiPrices(res.data)
  const summary = summarizePrices(prices)
  return {
    query,
    links: buildMarketLinks(query),
    samplePrices: prices.slice(0, 10),
    ...summary
  }
}

async function estimateFromEbaySold(query) {
  const links = buildMarketLinks(query)
  const res = await axios.get(links.ebaySold, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  })

  const prices = extractSoldPricesFromHtml(res.data)
  const summary = summarizePrices(prices)
  return {
    query,
    links,
    samplePrices: prices.slice(0, 10),
    ...summary
  }
}

async function estimateFromPriceCharting(query) {
  const links = buildMarketLinks(query)
  const res = await axios.get(links.priceCharting, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  })

  const html = String(res.data || '')
  const prices = []
  const regex = /\$\s*([0-9,]+(?:\.[0-9]{2})?)/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const parsed = Number(String(match[1]).replace(/,/g, ''))
    if (!Number.isFinite(parsed)) continue
    if (parsed <= 0 || parsed > 25000) continue
    prices.push(parsed)
    if (prices.length >= 30) break
  }

  const summary = summarizePrices(prices)
  return {
    query,
    links,
    samplePrices: prices.slice(0, 10),
    ...summary
  }
}

async function getCachedEstimate(item) {
  const query = buildMarketQuery(item)
  const fingerprintKey = pricingFingerprint(item)
  if (!query || !fingerprintKey) {
    return {
      fingerprint: fingerprintKey,
      query,
      links: query ? buildMarketLinks(query) : null,
      count: 0,
      median: null,
      avg: null,
      min: null,
      max: null,
      samplePrices: [],
      fromCache: false
    }
  }

  const cached = pricingEstimateCache.get(fingerprintKey)
  if (cached && (Date.now() - cached.updatedAt) < PRICING_CACHE_TTL_MS) {
    return { ...cached.value, fromCache: true }
  }

  let estimated = null
  let source = 'ebay_api'
  const errors = []

  try {
    estimated = await estimateFromEbayFindingApi(query)
    source = 'ebay_api'
  } catch (err) {
    errors.push(`eBay API: ${err.message || 'failed'}`)
  }

  if (!estimated?.count) {
    try {
      estimated = await estimateFromEbaySold(query)
      if (estimated?.count) source = 'ebay_scrape'
    } catch (err) {
      errors.push(`eBay scrape: ${err.message || 'failed'}`)
    }
  }

  if (!estimated?.count) {
    try {
      const priceCharting = await estimateFromPriceCharting(query)
      if (priceCharting?.count) {
        estimated = priceCharting
        source = 'pricecharting'
      }
    } catch (err) {
      errors.push(`PriceCharting: ${err.message || 'failed'}`)
    }
  }

  if (!estimated || !estimated.count) {
    estimated = {
      query,
      links: buildMarketLinks(query),
      samplePrices: [],
      count: 0,
      median: null,
      avg: null,
      min: null,
      max: null,
      estimateNote: 'No sold-price comps were retrieved yet.'
    }
    source = 'no_comps'
  }

  const value = {
    fingerprint: fingerprintKey,
    ...estimated,
    source,
    error: errors.length ? errors.join(' | ') : undefined,
    updatedAt: new Date().toISOString()
  }
  pricingEstimateCache.set(fingerprintKey, { updatedAt: Date.now(), value })
  return { ...value, fromCache: false }
}

function csvEscape(value) {
  const text = String(value ?? '')
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function yesNo(value, fallback = 'No') {
  const normalized = normalize(value)
  if (['yes', 'true', '1', 'y'].includes(normalized)) return 'Yes'
  if (['no', 'false', '0', 'n'].includes(normalized)) return 'No'
  return fallback
}

function mergeString(existing, incoming) {
  if (String(existing || '').trim()) return existing
  return String(incoming || '').trim()
}

function safeInt(value, fallback = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.round(n))
}

function toRecord(card, sport, importAttemptId, ownerUserId = null) {
  const now = new Date().toISOString()
  const record = {
    id: randomUUID(),
    ownerUserId,
    sport,
    sportNormalized: normalize(sport),
    fingerprint: '',
    pairType: String(card?.Side || ''),
    sku: String(card?.SKU || ''),
    name: String(card?.Name || ''),
    team: String(card?.Team || ''),
    position: String(card?.Position || ''),
    set: String(card?.Set || ''),
    year: String(card?.Year || ''),
    cardNumber: String(card?.CardNumber || ''),
    quantity: safeInt(card?.Quantity || 1),
    parallel: String(card?.Parallel || ''),
    rookie: String(card?.Rookie || 'No'),
    autograph: String(card?.Autograph || 'No'),
    title: String(card?.Title || ''),
    description: String(card?.Description || ''),
    pickFrom: String(card?.PickFrom || ''),
    filename: String(card?.Filename || ''),
    pictureUrl: String(card?.PictureURL || ''),
    lastImportAttemptId: importAttemptId || null,
    createdAt: now,
    updatedAt: now
  }
  record.fingerprint = fingerprint(record)
  return record
}

function fingerprint(record) {
  return [
    normalize(record.sport),
    normalize(record.name),
    normalize(record.team),
    normalize(record.set),
    normalize(record.year),
    normalize(record.cardNumber),
    normalize(record.parallel)
  ].join('|')
}

function mergeMissingStrings(target, source, keys) {
  keys.forEach((key) => {
    if (!target[key] && source[key]) target[key] = source[key]
  })
}

async function insertInventoryRow(record) {
  await dbRun(
    `INSERT INTO inventory (
      id, ownerUserId, sport, sportNormalized, fingerprint, pairType, sku, name, team, position, setName, year,
      cardNumber, quantity, parallel, rookie, autograph, title, description, pickFrom, filename,
      pictureUrl, lastImportAttemptId, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id, record.ownerUserId || null, record.sport, record.sportNormalized, record.fingerprint, record.pairType, record.sku,
      record.name, record.team, record.position, record.set, record.year, record.cardNumber, safeInt(record.quantity, 1),
      record.parallel, record.rookie, record.autograph, record.title, record.description, record.pickFrom,
      record.filename, record.pictureUrl, record.lastImportAttemptId, record.createdAt, record.updatedAt
    ]
  )
}

function rowToInventoryItem(row) {
  return {
    id: row.id,
    sport: row.sport,
    pairType: row.pairType,
    sku: row.sku,
    name: row.name,
    team: row.team,
    position: row.position,
    set: row.setName,
    year: row.year,
    cardNumber: row.cardNumber,
    quantity: safeInt(row.quantity, 1),
    parallel: row.parallel,
    rookie: row.rookie,
    autograph: row.autograph,
    title: row.title,
    description: row.description,
    pickFrom: row.pickFrom,
    filename: row.filename,
    pictureUrl: row.pictureUrl,
    lastImportAttemptId: row.lastImportAttemptId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

async function listInventory(sportFilter = '') {
  await initializeDatabase()

  const normalizedSport = normalize(sportFilter)
  const rows = normalizedSport
    ? await dbAll('SELECT * FROM inventory WHERE sportNormalized = ? ORDER BY updatedAt DESC', [normalizedSport])
    : await dbAll('SELECT * FROM inventory ORDER BY updatedAt DESC')

  return rows.map(rowToInventoryItem)
}

async function listInventoryForOwner(ownerUserId, sportFilter = '') {
  await initializeDatabase()

  const normalizedSport = normalize(sportFilter)
  const ownerScope = ownerWhereClause(ownerUserId)
  const params = [...ownerScope.params]
  let sql = `SELECT * FROM inventory WHERE ${ownerScope.clause}`

  if (normalizedSport) {
    sql += ' AND sportNormalized = ?'
    params.push(normalizedSport)
  }

  sql += ' ORDER BY updatedAt DESC'
  const rows = await dbAll(sql, params)
  return rows.map(rowToInventoryItem)
}

function buildFallbackTitle(item) {
  const parts = [item.year, item.set, item.name, item.cardNumber ? `#${item.cardNumber}` : '']
    .map((part) => String(part || '').trim())
    .filter(Boolean)
  const title = parts.join(' ')
  return title || 'Sports Trading Card'
}

function buildFallbackDescription(item) {
  const title = item.title || buildFallbackTitle(item)
  return `${title}. ${item.team ? `Team: ${item.team}. ` : ''}${item.parallel ? `Parallel: ${item.parallel}.` : ''}`.trim()
}

function extractYearForEbay(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/\d{4}/)
  return match ? match[0] : raw
}

function ebayDefaults(req) {
  return {
    categoryId: String(req.query.categoryId || process.env.EBAY_CATEGORY_ID || '261328'),
    conditionId: String(req.query.conditionId || process.env.EBAY_CONDITION_ID || '4000'),
    startPrice: String(req.query.startPrice || process.env.EBAY_DEFAULT_START_PRICE || '0.99'),
    location: String(req.query.location || process.env.EBAY_LOCATION || 'United States'),
    dispatchTimeMax: String(req.query.dispatchTimeMax || process.env.EBAY_DISPATCH_DAYS || '3'),
    returnsAccepted: String(req.query.returnsAccepted || process.env.EBAY_RETURNS_ACCEPTED || 'ReturnsAccepted'),
    shippingType: String(req.query.shippingType || process.env.EBAY_SHIPPING_TYPE || 'Flat'),
    shippingService1: String(req.query.shippingService1 || process.env.EBAY_SHIP_SERVICE_1 || 'USPS Ground Advantage'),
    shippingCost1: String(req.query.shippingCost1 || process.env.EBAY_SHIP_COST_1 || '0.00')
  }
}

function buildEbayTemplateRow(item, defaults) {
  const row = Object.fromEntries(EBAY_TEMPLATE_COLUMNS.map((column) => [column, '']))

  row['*Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)'] = 'Add'
  row.CustomLabel = item.sku || ''
  row['*Category'] = defaults.categoryId
  row['*Title'] = item.title || buildFallbackTitle(item)
  row['*ConditionID'] = defaults.conditionId
  row['*C:Sport'] = item.sport || 'Football'
  row['C:Player/Athlete'] = item.name || ''
  row['C:Year Manufactured'] = extractYearForEbay(item.year)
  row['C:Parallel/Variety'] = item.parallel || ''
  row['C:Set'] = item.set || ''
  row['C:Team'] = item.team || ''
  row['C:Autographed'] = yesNo(item.autograph, 'No')
  row['C:Card Name'] = item.name || ''
  row['C:Card Number'] = item.cardNumber || ''
  row['C:Type'] = 'Sports Trading Card'
  row.PicURL = item.pictureUrl || ''
  row['*Description'] = item.description || buildFallbackDescription(item)
  row['*Format'] = 'FixedPrice'
  row['*Duration'] = 'GTC'
  row['*StartPrice'] = defaults.startPrice
  row['*Quantity'] = String(safeInt(item.quantity, 1))
  row['*Location'] = defaults.location
  row.ShippingType = defaults.shippingType
  row['ShippingService-1:Option'] = defaults.shippingService1
  row['ShippingService-1:Cost'] = defaults.shippingCost1
  row['*DispatchTimeMax'] = defaults.dispatchTimeMax
  row['*ReturnsAcceptedOption'] = defaults.returnsAccepted
  row.ReturnsWithinOption = 'Days_30'
  row.RefundOption = 'MoneyBack'
  row.ShippingCostPaidByOption = 'Buyer'

  return row
}

function buildEbayCsv(items, defaults) {
  const lines = []
  lines.push(EBAY_TEMPLATE_COLUMNS.map(csvEscape).join(','))

  items.forEach((item) => {
    const mapped = buildEbayTemplateRow(item, defaults)
    const line = EBAY_TEMPLATE_COLUMNS.map((column) => csvEscape(mapped[column] || '')).join(',')
    lines.push(line)
  })

  return lines.join('\n')
}

function buildEbayCoverage(items, defaults) {
  const rows = items.map((item) => buildEbayTemplateRow(item, defaults))
  const byColumn = EBAY_TEMPLATE_COLUMNS.map((column) => {
    const nonEmptyCount = rows.reduce((acc, row) => acc + (String(row[column] || '').trim() ? 1 : 0), 0)
    return {
      column,
      required: EBAY_REQUIRED_COLUMNS.includes(column),
      mapped: Boolean(EBAY_COLUMN_SOURCES[column]),
      source: EBAY_COLUMN_SOURCES[column] || null,
      nonEmptyCount
    }
  })

  const missingRequiredMappings = byColumn
    .filter((entry) => entry.required && !entry.mapped)
    .map((entry) => entry.column)

  return {
    totalColumns: EBAY_TEMPLATE_COLUMNS.length,
    requiredColumns: EBAY_REQUIRED_COLUMNS.length,
    mappedColumns: byColumn.filter((entry) => entry.mapped).length,
    rowsEvaluated: rows.length,
    missingRequiredMappings,
    columns: byColumn
  }
}

router.get('/', async (req, res) => {
  try {
    const ownerUserId = await resolveInventoryOwnerUserId(req)
    const items = await listInventoryForOwner(ownerUserId, String(req.query.sport || ''))
    res.json({ items })
  } catch (err) {
    console.error('Inventory GET failed:', err)
    res.status(500).json({ error: 'Failed to load inventory.' })
  }
})

router.get('/ebay/coverage', async (req, res) => {
  try {
    const ownerUserId = await resolveInventoryOwnerUserId(req)
    const items = await listInventoryForOwner(ownerUserId, String(req.query.sport || ''))
    const defaults = ebayDefaults(req)
    const coverage = buildEbayCoverage(items, defaults)
    res.json({ ok: true, ...coverage })
  } catch (err) {
    console.error('Inventory eBay coverage failed:', err)
    res.status(500).json({ error: 'Failed to compute eBay coverage.' })
  }
})

router.get('/export/ebay-template.csv', async (req, res) => {
  try {
    const ownerUserId = await resolveInventoryOwnerUserId(req)
    const items = await listInventoryForOwner(ownerUserId, String(req.query.sport || ''))
    const defaults = ebayDefaults(req)
    const csv = buildEbayCsv(items, defaults)

    const sportPart = String(req.query.sport || 'all').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const datePart = new Date().toISOString().slice(0, 10)
    const filename = `ebay-template-${sportPart}-${datePart}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  } catch (err) {
    console.error('Inventory eBay export failed:', err)
    res.status(500).json({ error: 'Failed to export eBay CSV.' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await initializeDatabase()
    const ownerUserId = await resolveInventoryOwnerUserId(req)
    const ownerScope = ownerWhereClause(ownerUserId)

    const id = String(req.params?.id || '').trim()
    if (!id) {
      res.status(400).json({ error: 'Missing inventory row id.' })
      return
    }
  const result = await dbRun(`DELETE FROM inventory WHERE id = ? AND ${ownerScope.clause}`, [id, ...ownerScope.params])
    const deleted = Number(result?.changes || 0)
    res.json({ ok: true, deleted })
  } catch (err) {
    console.error('Inventory delete failed:', err)
    res.status(500).json({ error: 'Failed to delete inventory row.' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    await initializeDatabase()
    const ownerUserId = await resolveInventoryOwnerUserId(req)
    const ownerScope = ownerWhereClause(ownerUserId)

    const id = String(req.params?.id || '').trim()
    if (!id) {
      res.status(400).json({ error: 'Missing inventory row id.' })
      return
    }
  const existing = await dbGet(`SELECT * FROM inventory WHERE id = ? AND ${ownerScope.clause}`, [id, ...ownerScope.params])
    if (!existing) {
      res.status(404).json({ error: 'Inventory row not found.' })
      return
    }

    const body = req.body || {}
    const updated = {
      sport: String(body.sport ?? existing.sport ?? '').trim() || existing.sport,
      pairType: String(body.pairType ?? existing.pairType ?? '').trim(),
      sku: String(body.sku ?? existing.sku ?? '').trim(),
      name: String(body.name ?? existing.name ?? '').trim(),
      team: String(body.team ?? existing.team ?? '').trim(),
      position: String(body.position ?? existing.position ?? '').trim(),
      setName: String(body.set ?? existing.setName ?? '').trim(),
      year: String(body.year ?? existing.year ?? '').trim(),
      cardNumber: String(body.cardNumber ?? existing.cardNumber ?? '').trim(),
      quantity: safeInt(body.quantity ?? existing.quantity ?? 1, 1),
      parallel: String(body.parallel ?? existing.parallel ?? '').trim(),
      rookie: String(body.rookie ?? existing.rookie ?? '').trim(),
      autograph: String(body.autograph ?? existing.autograph ?? '').trim(),
      title: String(body.title ?? existing.title ?? '').trim(),
      description: String(body.description ?? existing.description ?? '').trim(),
      pickFrom: String(body.pickFrom ?? existing.pickFrom ?? '').trim(),
      filename: String(body.filename ?? existing.filename ?? '').trim(),
      pictureUrl: String(body.pictureUrl ?? existing.pictureUrl ?? '').trim()
    }

    const nextFingerprint = [
      normalize(updated.sport),
      normalize(updated.name),
      normalize(updated.team),
      normalize(updated.setName),
      normalize(updated.year),
      normalize(updated.cardNumber),
      normalize(updated.parallel)
    ].join('|')
    const conflict = await dbGet(
      `SELECT id FROM inventory WHERE fingerprint = ? AND id <> ? AND ${ownerScope.clause}`,
      [nextFingerprint, id, ...ownerScope.params]
    )
    if (conflict) {
      res.status(409).json({ error: 'Updating this row would duplicate another inventory fingerprint.' })
      return
    }

    const updatedAt = new Date().toISOString()

    await dbRun(
      `UPDATE inventory
       SET sport = ?, sportNormalized = ?, fingerprint = ?, pairType = ?, sku = ?, name = ?, team = ?, position = ?,
           setName = ?, year = ?, cardNumber = ?, quantity = ?, parallel = ?, rookie = ?, autograph = ?, title = ?,
           description = ?, pickFrom = ?, filename = ?, pictureUrl = ?, updatedAt = ?
       WHERE id = ?`,
      [
        updated.sport,
        normalize(updated.sport),
        nextFingerprint,
        updated.pairType,
        updated.sku,
        updated.name,
        updated.team,
        updated.position,
        updated.setName,
        updated.year,
        updated.cardNumber,
        updated.quantity,
        updated.parallel,
        updated.rookie,
        updated.autograph,
        updated.title,
        updated.description,
        updated.pickFrom,
        updated.filename,
        updated.pictureUrl,
        updatedAt,
        id
      ]
    )
  const row = await dbGet(`SELECT * FROM inventory WHERE id = ? AND ${ownerScope.clause}`, [id, ...ownerScope.params])
    res.json({ ok: true, item: rowToInventoryItem(row) })
  } catch (err) {
    console.error('Inventory update failed:', err)
    res.status(500).json({ error: 'Failed to update inventory row.' })
  }
})

router.delete('/', async (req, res) => {
  try {
    await initializeDatabase()
    const ownerUserId = await resolveInventoryOwnerUserId(req)
    const ownerScope = ownerWhereClause(ownerUserId)

    const clearAll = ['1', 'true', 'yes'].includes(String(req.query?.all || '').toLowerCase())
    const sport = String(req.query?.sport || '').trim()

    let result
    if (clearAll) {
      result = await dbRun(`DELETE FROM inventory WHERE ${ownerScope.clause}`, ownerScope.params)
    } else {
      const normalizedSport = normalize(sport)
      if (!normalizedSport) {
        res.status(400).json({ error: 'Provide sport query or set all=true.' })
        return
      }
      result = await dbRun(`DELETE FROM inventory WHERE ${ownerScope.clause} AND sportNormalized = ?`, [...ownerScope.params, normalizedSport])
    }

    const deleted = Number(result?.changes || 0)
    res.json({ ok: true, deleted, mode: clearAll ? 'all' : 'sport' })
  } catch (err) {
    console.error('Inventory clear failed:', err)
    res.status(500).json({ error: 'Failed to clear inventory.' })
  }
})

router.post('/bulk', async (req, res) => {
  try {
    await initializeDatabase()
    const ownerUserId = await resolveInventoryOwnerUserId(req)
    const ownerScope = ownerWhereClause(ownerUserId)

    const sport = String(req.body?.sport || '').trim() || 'Football'
    const cards = Array.isArray(req.body?.cards) ? req.body.cards : []
    const importAttemptId = randomUUID()

    if (!cards.length) {
      res.status(400).json({ error: 'No cards provided.' })
      return
    }

    let inserted = 0
    let updated = 0

    await dbRun('BEGIN')

    try {
      for (const card of cards) {
        const incoming = toRecord(card, sport, importAttemptId, ownerUserId)
        const existing = await dbGet(
          `SELECT * FROM inventory WHERE fingerprint = ? AND ${ownerScope.clause}`,
          [incoming.fingerprint, ...ownerScope.params]
        )

        if (existing) {
          const merged = {
            sport: existing.sport,
            pairType: mergeString(existing.pairType, incoming.pairType),
            sku: mergeString(existing.sku, incoming.sku),
            name: existing.name,
            team: existing.team,
            position: mergeString(existing.position, incoming.position),
            setName: existing.setName,
            year: existing.year,
            cardNumber: existing.cardNumber,
            quantity: safeInt(existing.quantity, 1) + safeInt(incoming.quantity, 1),
            parallel: existing.parallel,
            rookie: mergeString(existing.rookie, incoming.rookie),
            autograph: mergeString(existing.autograph, incoming.autograph),
            title: mergeString(existing.title, incoming.title),
            description: mergeString(existing.description, incoming.description),
            pickFrom: mergeString(existing.pickFrom, incoming.pickFrom),
            filename: mergeString(existing.filename, incoming.filename),
            pictureUrl: mergeString(existing.pictureUrl, incoming.pictureUrl),
            lastImportAttemptId: importAttemptId,
            updatedAt: new Date().toISOString()
          }

          await dbRun(
            `UPDATE inventory
             SET pairType = ?, sku = ?, position = ?, quantity = ?, rookie = ?, autograph = ?, title = ?,
                 description = ?, pickFrom = ?, filename = ?, pictureUrl = ?, lastImportAttemptId = ?, updatedAt = ?
             WHERE id = ?`,
            [
              merged.pairType, merged.sku, merged.position, merged.quantity, merged.rookie, merged.autograph,
              merged.title, merged.description, merged.pickFrom, merged.filename, merged.pictureUrl,
              merged.lastImportAttemptId, merged.updatedAt, existing.id
            ]
          )
          updated += 1
        } else {
          await insertInventoryRow(incoming)
          inserted += 1
        }
      }

      await dbRun('COMMIT')
    } catch (err) {
      await dbRun('ROLLBACK')
      throw err
    }

    const totalRow = await dbGet(`SELECT COUNT(1) AS total FROM inventory WHERE ${ownerScope.clause}`, ownerScope.params)
    res.json({ ok: true, importAttemptId, inserted, updated, total: Number(totalRow?.total || 0) })
  } catch (err) {
    console.error('Inventory bulk save failed:', err)
    res.status(500).json({ error: 'Failed to save inventory.' })
  }
})

router.post('/pricing/estimate-batch', async (req, res) => {
  try {
    const cards = Array.isArray(req.body?.cards) ? req.body.cards : []
    if (!cards.length) {
      res.json({ ok: true, estimates: [] })
      return
    }

    const uniqueByFingerprint = new Map()
    cards.forEach((card) => {
      const fp = pricingFingerprint(card)
      if (!fp || uniqueByFingerprint.has(fp)) return
      uniqueByFingerprint.set(fp, card)
    })

    const estimates = []
    for (const card of uniqueByFingerprint.values()) {
      // Sequential fetch keeps request volume low and avoids rate spikes.
      const estimate = await getCachedEstimate(card)
      estimates.push(estimate)
    }

    res.json({
      ok: true,
      ttlMs: PRICING_CACHE_TTL_MS,
      estimates
    })
  } catch (err) {
    console.error('Pricing estimate batch failed:', err)
    res.status(500).json({ error: 'Failed to estimate pricing.' })
  }
})

export default router
