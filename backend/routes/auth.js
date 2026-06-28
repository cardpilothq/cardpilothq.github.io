import express from 'express'
import {
  authenticateUser,
  consumeOAuthState,
  createOAuthState,
  createSession,
  createUser,
  getOAuthCredential,
  getSupportedProviders,
  getUserContextFromToken,
  initializeAuthDatabase,
  listUserConnections,
  revokeSession,
  updateUserProfile,
  upsertOAuthCredential,
  upsertUserConnection
} from '../services/authService.js'
import {
  buildEbayConsentUrl,
  exchangeEbayAuthorizationCode,
  resolveEbayOAuthConfig,
  resolveFrontendReturnUrl,
  validateEbayOAuthConfig
} from '../services/ebayOAuthService.js'

const router = express.Router()

function extractBearerToken(req) {
  const header = String(req.headers.authorization || '').trim()
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim()
  }
  return ''
}

async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req)
    const context = await getUserContextFromToken(token)
    if (!context?.user) {
      return res.status(401).json({ error: 'Unauthorized', details: 'A valid user session is required.' })
    }

    req.auth = context
    next()
  } catch (err) {
    console.error('Auth middleware failed:', err)
    res.status(500).json({ error: 'Failed to verify user session.' })
  }
}

async function buildAuthResponse(user) {
  const session = await createSession(user.id)
  const connections = await listUserConnections(user.id)
  return {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user,
    connections,
    providers: getSupportedProviders()
  }
}

function appendQueryParams(path, entries = {}) {
  const safePath = String(path || '/?page=profile').startsWith('/') ? String(path || '/?page=profile') : '/?page=profile'
  const url = new URL(safePath, 'http://cardpilot.local')
  Object.entries(entries).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    url.searchParams.set(key, String(value))
  })
  return `${url.pathname}${url.search}${url.hash}`
}

function redirectToFrontend(req, res, path, query = {}) {
  const target = appendQueryParams(path, query)
  res.redirect(resolveFrontendReturnUrl(req, target))
}

function summarizeEbayCredential(credential) {
  if (!credential) {
    return {
      connected: false,
      expiresAt: null,
      scope: '',
      environment: resolveEbayOAuthConfig().environment
    }
  }

  return {
    connected: Boolean(credential.refreshToken || credential.accessToken),
    expiresAt: credential.expiresAt || null,
    refreshTokenExpiresAt: credential.refreshTokenExpiresAt || null,
    scope: credential.scope || '',
    environment: resolveEbayOAuthConfig().environment,
    tokenType: credential.tokenType || ''
  }
}

router.get('/providers', async (req, res) => {
  try {
    await initializeAuthDatabase()
    res.json({ ok: true, providers: getSupportedProviders() })
  } catch (err) {
    console.error('Auth providers load failed:', err)
    res.status(500).json({ error: 'Failed to load connection providers.' })
  }
})

router.post('/signup', async (req, res) => {
  try {
    const user = await createUser({
      email: req.body?.email,
      password: req.body?.password,
      displayName: req.body?.displayName
    })

    res.status(201).json(await buildAuthResponse(user))
  } catch (err) {
    const message = err?.message || 'Could not create account.'
    const statusCode = /exists|required|valid|password/i.test(message) ? 400 : 500
    if (statusCode === 500) console.error('Signup failed:', err)
    res.status(statusCode).json({ error: message })
  }
})

router.post('/login', async (req, res) => {
  try {
    const user = await authenticateUser({
      email: req.body?.email,
      password: req.body?.password
    })

    res.json(await buildAuthResponse(user))
  } catch (err) {
    const message = err?.message || 'Could not log in.'
    const statusCode = /invalid/i.test(message) ? 401 : 400
    if (statusCode >= 500) console.error('Login failed:', err)
    res.status(statusCode).json({ error: message })
  }
})

router.post('/logout', requireAuth, async (req, res) => {
  try {
    const token = extractBearerToken(req)
    await revokeSession(token)
    res.json({ ok: true })
  } catch (err) {
    console.error('Logout failed:', err)
    res.status(500).json({ error: 'Failed to log out.' })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  try {
    const connections = await listUserConnections(req.auth.user.id)
    res.json({
      ok: true,
      user: req.auth.user,
      session: req.auth.session,
      connections,
      providers: getSupportedProviders()
    })
  } catch (err) {
    console.error('Profile load failed:', err)
    res.status(500).json({ error: 'Failed to load user profile.' })
  }
})

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const user = await updateUserProfile(req.auth.user.id, {
      displayName: req.body?.displayName
    })
    const connections = await listUserConnections(req.auth.user.id)
    res.json({ ok: true, user, connections })
  } catch (err) {
    const message = err?.message || 'Failed to update profile.'
    const statusCode = /not found/i.test(message) ? 404 : 400
    if (statusCode >= 500) console.error('Profile update failed:', err)
    res.status(statusCode).json({ error: message })
  }
})

router.put('/connections/:provider', requireAuth, async (req, res) => {
  try {
    const connection = await upsertUserConnection(req.auth.user.id, req.params.provider, req.body || {})
    const connections = await listUserConnections(req.auth.user.id)
    res.json({ ok: true, connection, connections })
  } catch (err) {
    const message = err?.message || 'Failed to save connection.'
    const statusCode = /unsupported|required/i.test(message) ? 400 : 500
    if (statusCode >= 500) console.error('Connection save failed:', err)
    res.status(statusCode).json({ error: message })
  }
})

router.get('/ebay/status', requireAuth, async (req, res) => {
  try {
    const validation = validateEbayOAuthConfig()
    const connections = await listUserConnections(req.auth.user.id)
    const connection = connections.find((item) => item.provider === 'ebay') || null
    const credential = await getOAuthCredential(req.auth.user.id, 'ebay')
    res.json({
      ok: true,
      configured: validation.ok,
      missing: validation.missing,
      environment: validation.config.environment,
      scopes: validation.config.scopes,
      connection,
      oauth: summarizeEbayCredential(credential)
    })
  } catch (err) {
    console.error('eBay OAuth status failed:', err)
    res.status(500).json({ error: 'Failed to load eBay OAuth status.' })
  }
})

router.get('/ebay/start', requireAuth, async (req, res) => {
  try {
    const validation = validateEbayOAuthConfig()
    if (!validation.ok) {
      return res.status(400).json({
        error: 'eBay OAuth is not configured.',
        missing: validation.missing
      })
    }

    const returnPath = String(req.query.returnPath || '/?page=profile').trim() || '/?page=profile'
    const state = await createOAuthState({
      userId: req.auth.user.id,
      provider: 'ebay',
      returnPath
    })
    const authUrl = buildEbayConsentUrl({ state, config: validation.config })
    res.json({
      ok: true,
      authUrl,
      environment: validation.config.environment,
      scopes: validation.config.scopes
    })
  } catch (err) {
    console.error('eBay OAuth start failed:', err)
    res.status(500).json({ error: 'Failed to start eBay OAuth.' })
  }
})

router.get('/ebay/callback', async (req, res) => {
  const rawState = String(req.query.state || '').trim()
  const rawError = String(req.query.error || '').trim()
  const errorDescription = String(req.query.error_description || '').trim()
  const rawCode = String(req.query.code || '').trim()

  try {
    const stateRecord = await consumeOAuthState('ebay', rawState)
    if (!stateRecord?.userId) {
      return redirectToFrontend(req, res, '/?page=profile', {
        oauth: 'ebay-error',
        oauthMessage: 'The eBay login session expired or is invalid.'
      })
    }

    if (rawError) {
      return redirectToFrontend(req, res, stateRecord.returnPath, {
        oauth: 'ebay-error',
        oauthMessage: errorDescription || rawError
      })
    }

    if (!rawCode) {
      return redirectToFrontend(req, res, stateRecord.returnPath, {
        oauth: 'ebay-error',
        oauthMessage: 'eBay did not return an authorization code.'
      })
    }

    const config = resolveEbayOAuthConfig()
    const tokenPayload = await exchangeEbayAuthorizationCode(rawCode, config)
    await upsertOAuthCredential(stateRecord.userId, 'ebay', tokenPayload)

    const connections = await listUserConnections(stateRecord.userId)
    const existingConnection = connections.find((item) => item.provider === 'ebay') || null
    await upsertUserConnection(stateRecord.userId, 'ebay', {
      status: 'connected',
      capability: existingConnection?.capability || 'research+listings',
      authType: 'oauth',
      accountLabel: existingConnection?.accountLabel || 'eBay OAuth connected',
      notes: existingConnection?.notes || 'Connected using live eBay OAuth.',
      metadata: {
        ...(existingConnection?.metadata || {}),
        oauthConnected: true,
        oauthEnvironment: config.environment,
        oauthConnectedAt: new Date().toISOString(),
        oauthExpiresAt: tokenPayload.expiresAt,
        oauthScope: tokenPayload.scope
      }
    })

    return redirectToFrontend(req, res, stateRecord.returnPath, {
      oauth: 'ebay-success',
      oauthMessage: 'eBay OAuth connected successfully.'
    })
  } catch (err) {
    console.error('eBay OAuth callback failed:', err)
    return redirectToFrontend(req, res, '/?page=profile', {
      oauth: 'ebay-error',
      oauthMessage: err?.message || 'eBay OAuth failed.'
    })
  }
})

export default router
