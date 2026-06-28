import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import sqlite3 from 'sqlite3'
import fs from 'fs/promises'
import path from 'path'

const scrypt = promisify(scryptCallback)
const dataDir = path.join(process.cwd(), 'data')
const sqlitePath = path.join(dataDir, 'auth.db')
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const SUPPORTED_PROVIDERS = [
  {
    key: 'ebay',
    label: 'eBay',
    category: 'listing',
    authTypes: ['oauth', 'api-key', 'manual'],
    supportsDirectAuth: true,
    notes: 'Best target for listing submission and sold-listing research.'
  },
  {
    key: '130point',
    label: '130point.com',
    category: 'research',
    authTypes: ['manual', 'cookie-session'],
    supportsDirectAuth: false,
    notes: 'Typically used as a research surface; direct authentication may require a custom workflow.'
  },
  {
    key: 'collx',
    label: 'CollX',
    category: 'research',
    authTypes: ['oauth', 'manual'],
    supportsDirectAuth: false,
    notes: 'Useful for research and collection pricing workflows.'
  },
  {
    key: 'ludex',
    label: 'Ludex',
    category: 'research',
    authTypes: ['oauth', 'manual'],
    supportsDirectAuth: false,
    notes: 'Useful for pricing and collection insights.'
  },
  {
    key: 'other',
    label: 'Other',
    category: 'custom',
    authTypes: ['oauth', 'api-key', 'manual', 'cookie-session'],
    supportsDirectAuth: false,
    notes: 'Fallback for additional marketplaces, research tools, or listing systems.'
  }
]

let db = null
let initPromise = null

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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function slugifyConnectionName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function safeDisplayName(value, fallbackEmail = '') {
  const trimmed = String(value || '').trim()
  if (trimmed) return trimmed.slice(0, 80)
  const localPart = String(fallbackEmail || '').split('@')[0] || 'CardPilot User'
  return localPart.slice(0, 80)
}

function hashToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex')
}

async function hashPassword(password, salt) {
  const derived = await scrypt(String(password || ''), salt, 64)
  return Buffer.from(derived).toString('hex')
}

function compareHashes(expectedHex, receivedHex) {
  const expected = Buffer.from(String(expectedHex || ''), 'hex')
  const received = Buffer.from(String(receivedHex || ''), 'hex')
  if (!expected.length || expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}

function rowToUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt
  }
}

function rowToConnection(row) {
  if (!row) return null
  let metadata = {}
  try {
    metadata = row.metadata ? JSON.parse(row.metadata) : {}
  } catch {
    metadata = {}
  }

  return {
    id: row.id,
    provider: row.provider,
    providerSlug: row.providerSlug,
    providerLabel: row.providerLabel,
    customProviderName: row.customProviderName || '',
    status: row.status,
    capability: row.capability,
    authType: row.authType,
    accountLabel: row.accountLabel || '',
    notes: row.notes || '',
    metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export async function initializeAuthDatabase() {
  if (initPromise) return initPromise

  initPromise = (async () => {
    await fs.mkdir(dataDir, { recursive: true })
    await openDatabase()
    await dbRun('PRAGMA journal_mode = WAL')
    await dbRun('PRAGMA synchronous = NORMAL')

    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        emailNormalized TEXT NOT NULL UNIQUE,
        displayName TEXT NOT NULL,
        passwordSalt TEXT NOT NULL,
        passwordHash TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        lastLoginAt TEXT
      )
    `)

    await dbRun(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        tokenHash TEXT NOT NULL UNIQUE,
        createdAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        lastUsedAt TEXT NOT NULL,
        revokedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `)

    await dbRun(`
      CREATE TABLE IF NOT EXISTS user_connections (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        provider TEXT NOT NULL,
        providerSlug TEXT NOT NULL,
        providerLabel TEXT NOT NULL,
        customProviderName TEXT,
        status TEXT NOT NULL,
        capability TEXT NOT NULL,
        authType TEXT NOT NULL,
        accountLabel TEXT,
        notes TEXT,
        metadata TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `)

    await dbRun(`
      CREATE TABLE IF NOT EXISTS oauth_states (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        provider TEXT NOT NULL,
        stateHash TEXT NOT NULL UNIQUE,
        returnPath TEXT,
        createdAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        usedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `)

    await dbRun(`
      CREATE TABLE IF NOT EXISTS user_oauth_credentials (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        provider TEXT NOT NULL,
        accessToken TEXT,
        refreshToken TEXT,
        tokenType TEXT,
        scope TEXT,
        expiresAt TEXT,
        refreshTokenExpiresAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `)

    try {
      await dbRun('ALTER TABLE user_connections ADD COLUMN providerSlug TEXT')
    } catch {
      // Column already exists.
    }

    await dbRun(`
      UPDATE user_connections
         SET providerSlug = CASE
           WHEN lower(provider) = 'other' THEN
             CASE
               WHEN trim(COALESCE(customProviderName, '')) <> ''
                 THEN 'other:' || lower(replace(trim(customProviderName), ' ', '-'))
               ELSE 'other:custom'
             END
           ELSE lower(provider)
         END
       WHERE providerSlug IS NULL OR trim(providerSlug) = ''
    `)

    await dbRun('CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (userId)')
    await dbRun('CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions (expiresAt)')
    await dbRun('CREATE INDEX IF NOT EXISTS idx_oauth_states_user ON oauth_states (userId, provider)')
    await dbRun('CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states (expiresAt)')
    await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_oauth_credentials_unique ON user_oauth_credentials (userId, provider)')
    await dbRun('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_connections_unique ON user_connections (userId, providerSlug)')
  })()

  return initPromise
}

export function getSupportedProviders() {
  return SUPPORTED_PROVIDERS.map((provider) => ({ ...provider }))
}

export async function createUser({ email, password, displayName }) {
  await initializeAuthDatabase()

  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('A valid email address is required.')
  }

  const rawPassword = String(password || '')
  if (rawPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.')
  }

  const existing = await dbGet('SELECT id FROM users WHERE emailNormalized = ?', [normalizedEmail])
  if (existing?.id) {
    throw new Error('An account with that email already exists.')
  }

  const now = new Date().toISOString()
  const userId = randomUUID()
  const passwordSalt = randomBytes(16).toString('hex')
  const passwordHash = await hashPassword(rawPassword, passwordSalt)
  const safeName = safeDisplayName(displayName, normalizedEmail)

  await dbRun(
    `INSERT INTO users (
      id, email, emailNormalized, displayName, passwordSalt, passwordHash, createdAt, updatedAt, lastLoginAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [userId, String(email || '').trim(), normalizedEmail, safeName, passwordSalt, passwordHash, now, now, now]
  )

  const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId])
  return rowToUser(user)
}

export async function authenticateUser({ email, password }) {
  await initializeAuthDatabase()

  const normalizedEmail = normalizeEmail(email)
  const userRow = await dbGet('SELECT * FROM users WHERE emailNormalized = ?', [normalizedEmail])
  if (!userRow) {
    throw new Error('Invalid email or password.')
  }

  const attemptedHash = await hashPassword(String(password || ''), userRow.passwordSalt)
  const passwordMatches = compareHashes(userRow.passwordHash, attemptedHash)
  if (!passwordMatches) {
    throw new Error('Invalid email or password.')
  }

  const now = new Date().toISOString()
  await dbRun('UPDATE users SET lastLoginAt = ?, updatedAt = ? WHERE id = ?', [now, now, userRow.id])
  const updated = await dbGet('SELECT * FROM users WHERE id = ?', [userRow.id])
  return rowToUser(updated)
}

export async function createSession(userId) {
  await initializeAuthDatabase()

  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString()
  const createdAt = now.toISOString()

  await dbRun(
    `INSERT INTO user_sessions (
      id, userId, tokenHash, createdAt, expiresAt, lastUsedAt, revokedAt
    ) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    [randomUUID(), userId, hashToken(token), createdAt, expiresAt, createdAt]
  )

  return {
    token,
    expiresAt
  }
}

export async function revokeSession(token) {
  await initializeAuthDatabase()
  const tokenHash = hashToken(token)
  await dbRun('UPDATE user_sessions SET revokedAt = ? WHERE tokenHash = ? AND revokedAt IS NULL', [new Date().toISOString(), tokenHash])
}

export async function getUserContextFromToken(token) {
  await initializeAuthDatabase()

  const rawToken = String(token || '').trim()
  if (!rawToken) return null

  const sessionRow = await dbGet(
    `SELECT s.*, u.id AS userId, u.email, u.displayName, u.createdAt AS userCreatedAt,
            u.updatedAt AS userUpdatedAt, u.lastLoginAt
       FROM user_sessions s
       JOIN users u ON u.id = s.userId
      WHERE s.tokenHash = ?
        AND s.revokedAt IS NULL`,
    [hashToken(rawToken)]
  )

  if (!sessionRow) return null

  const expiresAtMs = Date.parse(sessionRow.expiresAt)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    await dbRun('UPDATE user_sessions SET revokedAt = ? WHERE id = ?', [new Date().toISOString(), sessionRow.id])
    return null
  }

  await dbRun('UPDATE user_sessions SET lastUsedAt = ? WHERE id = ?', [new Date().toISOString(), sessionRow.id])

  return {
    user: {
      id: sessionRow.userId,
      email: sessionRow.email,
      displayName: sessionRow.displayName,
      createdAt: sessionRow.userCreatedAt,
      updatedAt: sessionRow.userUpdatedAt,
      lastLoginAt: sessionRow.lastLoginAt
    },
    session: {
      id: sessionRow.id,
      expiresAt: sessionRow.expiresAt,
      createdAt: sessionRow.createdAt,
      lastUsedAt: sessionRow.lastUsedAt
    }
  }
}

export async function updateUserProfile(userId, { displayName }) {
  await initializeAuthDatabase()

  const existing = await dbGet('SELECT * FROM users WHERE id = ?', [userId])
  if (!existing) {
    throw new Error('User not found.')
  }

  const nextDisplayName = safeDisplayName(displayName, existing.email)
  const now = new Date().toISOString()
  await dbRun('UPDATE users SET displayName = ?, updatedAt = ? WHERE id = ?', [nextDisplayName, now, userId])
  const updated = await dbGet('SELECT * FROM users WHERE id = ?', [userId])
  return rowToUser(updated)
}

export async function listUserConnections(userId) {
  await initializeAuthDatabase()
  const rows = await dbAll('SELECT * FROM user_connections WHERE userId = ? ORDER BY providerLabel COLLATE NOCASE ASC', [userId])
  return rows.map(rowToConnection)
}

export async function upsertUserConnection(userId, providerKey, payload = {}) {
  await initializeAuthDatabase()

  const normalizedProvider = String(providerKey || '').trim().toLowerCase()
  if (!normalizedProvider) {
    throw new Error('Provider is required.')
  }

  const providerTemplate = SUPPORTED_PROVIDERS.find((item) => item.key === normalizedProvider)
  const customProviderName = normalizedProvider === 'other'
    ? String(payload.customProviderName || '').trim().slice(0, 80)
    : ''
  const providerSlug = normalizedProvider === 'other'
    ? `other:${slugifyConnectionName(customProviderName) || 'custom'}`
    : normalizedProvider

  const providerLabel = customProviderName || providerTemplate?.label || String(payload.providerLabel || normalizedProvider).trim().slice(0, 80) || normalizedProvider
  const status = String(payload.status || 'planned').trim().toLowerCase()
  const capability = String(payload.capability || 'research').trim().toLowerCase()
  const authType = String(payload.authType || 'manual').trim().toLowerCase()
  const accountLabel = String(payload.accountLabel || '').trim().slice(0, 120)
  const notes = String(payload.notes || '').trim().slice(0, 1000)
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}

  const allowedStatuses = new Set(['planned', 'connected', 'research-only', 'listing-only', 'paused'])
  const allowedCapabilities = new Set(['research', 'listings', 'research+listings'])
  const allowedAuthTypes = new Set(['oauth', 'api-key', 'manual', 'cookie-session'])

  if (!allowedStatuses.has(status)) {
    throw new Error('Unsupported connection status.')
  }
  if (!allowedCapabilities.has(capability)) {
    throw new Error('Unsupported connection capability.')
  }
  if (!allowedAuthTypes.has(authType)) {
    throw new Error('Unsupported connection auth type.')
  }
  if (normalizedProvider === 'other' && !customProviderName) {
    throw new Error('Custom provider name is required for Other connections.')
  }

  const existing = await dbGet('SELECT * FROM user_connections WHERE userId = ? AND providerSlug = ?', [userId, providerSlug])
  const now = new Date().toISOString()
  const serializedMetadata = JSON.stringify(metadata)

  if (existing?.id) {
    await dbRun(
      `UPDATE user_connections
          SET provider = ?,
              providerSlug = ?,
              providerLabel = ?,
              customProviderName = ?,
              status = ?,
              capability = ?,
              authType = ?,
              accountLabel = ?,
              notes = ?,
              metadata = ?,
              updatedAt = ?
        WHERE id = ?`,
      [normalizedProvider, providerSlug, providerLabel, customProviderName || null, status, capability, authType, accountLabel || null, notes || null, serializedMetadata, now, existing.id]
    )
    const updated = await dbGet('SELECT * FROM user_connections WHERE id = ?', [existing.id])
    return rowToConnection(updated)
  }

  const connectionId = randomUUID()
  await dbRun(
    `INSERT INTO user_connections (
      id, userId, provider, providerSlug, providerLabel, customProviderName, status, capability, authType, accountLabel, notes, metadata, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [connectionId, userId, normalizedProvider, providerSlug, providerLabel, customProviderName || null, status, capability, authType, accountLabel || null, notes || null, serializedMetadata, now, now]
  )

  const created = await dbGet('SELECT * FROM user_connections WHERE id = ?', [connectionId])
  return rowToConnection(created)
}

export async function createOAuthState({ userId, provider, returnPath = '/?page=profile' }) {
  await initializeAuthDatabase()

  const rawState = randomBytes(24).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + (1000 * 60 * 15)).toISOString()
  await dbRun(
    `INSERT INTO oauth_states (
      id, userId, provider, stateHash, returnPath, createdAt, expiresAt, usedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [randomUUID(), userId, String(provider || '').trim().toLowerCase(), hashToken(rawState), String(returnPath || '/?page=profile').trim(), now.toISOString(), expiresAt]
  )

  return rawState
}

export async function consumeOAuthState(provider, state) {
  await initializeAuthDatabase()

  const normalizedProvider = String(provider || '').trim().toLowerCase()
  const rawState = String(state || '').trim()
  if (!normalizedProvider || !rawState) return null

  const row = await dbGet(
    `SELECT * FROM oauth_states
      WHERE provider = ?
        AND stateHash = ?
        AND usedAt IS NULL`,
    [normalizedProvider, hashToken(rawState)]
  )

  if (!row) return null
  const expiresAtMs = Date.parse(row.expiresAt)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    await dbRun('UPDATE oauth_states SET usedAt = ? WHERE id = ?', [new Date().toISOString(), row.id])
    return null
  }

  const usedAt = new Date().toISOString()
  await dbRun('UPDATE oauth_states SET usedAt = ? WHERE id = ?', [usedAt, row.id])
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    returnPath: row.returnPath || '/?page=profile',
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    usedAt
  }
}

export async function upsertOAuthCredential(userId, provider, credential = {}) {
  await initializeAuthDatabase()

  const normalizedProvider = String(provider || '').trim().toLowerCase()
  if (!userId || !normalizedProvider) {
    throw new Error('User and provider are required for OAuth credentials.')
  }

  const now = new Date().toISOString()
  const existing = await dbGet('SELECT * FROM user_oauth_credentials WHERE userId = ? AND provider = ?', [userId, normalizedProvider])
  const next = {
    accessToken: String(credential.accessToken || '').trim(),
    refreshToken: String(credential.refreshToken || '').trim() || String(existing?.refreshToken || '').trim(),
    tokenType: String(credential.tokenType || '').trim(),
    scope: String(credential.scope || '').trim(),
    expiresAt: credential.expiresAt ? String(credential.expiresAt).trim() : null,
    refreshTokenExpiresAt: credential.refreshTokenExpiresAt ? String(credential.refreshTokenExpiresAt).trim() : null
  }

  if (existing?.id) {
    await dbRun(
      `UPDATE user_oauth_credentials
          SET accessToken = ?,
              refreshToken = ?,
              tokenType = ?,
              scope = ?,
              expiresAt = ?,
              refreshTokenExpiresAt = ?,
              updatedAt = ?
        WHERE id = ?`,
      [next.accessToken || null, next.refreshToken || null, next.tokenType || null, next.scope || null, next.expiresAt, next.refreshTokenExpiresAt, now, existing.id]
    )
    return
  }

  await dbRun(
    `INSERT INTO user_oauth_credentials (
      id, userId, provider, accessToken, refreshToken, tokenType, scope, expiresAt, refreshTokenExpiresAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), userId, normalizedProvider, next.accessToken || null, next.refreshToken || null, next.tokenType || null, next.scope || null, next.expiresAt, next.refreshTokenExpiresAt, now, now]
  )
}

export async function getOAuthCredential(userId, provider) {
  await initializeAuthDatabase()
  const normalizedProvider = String(provider || '').trim().toLowerCase()
  if (!userId || !normalizedProvider) return null

  const row = await dbGet('SELECT * FROM user_oauth_credentials WHERE userId = ? AND provider = ?', [userId, normalizedProvider])
  if (!row) return null

  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    accessToken: row.accessToken || '',
    refreshToken: row.refreshToken || '',
    tokenType: row.tokenType || '',
    scope: row.scope || '',
    expiresAt: row.expiresAt || null,
    refreshTokenExpiresAt: row.refreshTokenExpiresAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}
