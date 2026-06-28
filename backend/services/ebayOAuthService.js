import axios from 'axios'

const DEFAULT_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly'
]

function normalizeEnvironment(value) {
  const inferredAppEnv = String(process.env.APP_ENV || process.env.NODE_ENV || '').trim().toLowerCase()
  const fallbackEnv = (!inferredAppEnv || ['development', 'dev', 'qa', 'poc', 'test'].includes(inferredAppEnv))
    ? 'sandbox'
    : 'production'
  const env = String(value || fallbackEnv).trim().toLowerCase()
  return env === 'sandbox' ? 'sandbox' : 'production'
}

export function resolveEbayOAuthConfig() {
  const environment = normalizeEnvironment(process.env.EBAY_ENV)
  const clientId = String(process.env.EBAY_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.EBAY_CLIENT_SECRET || '').trim()
  const runame = String(process.env.EBAY_RUNAME || '').trim()
  const frontendBaseUrl = String(process.env.FRONTEND_BASE_URL || '').trim()
  const rawScopes = String(process.env.EBAY_OAUTH_SCOPES || '').trim()
  const scopes = rawScopes
    ? rawScopes.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean)
    : DEFAULT_SCOPES

  return {
    environment,
    clientId,
    clientSecret,
    runame,
    frontendBaseUrl,
    scopes,
    authBaseUrl: environment === 'sandbox'
      ? 'https://auth.sandbox.ebay.com/oauth2/authorize'
      : 'https://auth.ebay.com/oauth2/authorize',
    tokenUrl: environment === 'sandbox'
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token'
  }
}

export function validateEbayOAuthConfig(config = resolveEbayOAuthConfig()) {
  const missing = []
  if (!config.clientId) missing.push('EBAY_CLIENT_ID')
  if (!config.clientSecret) missing.push('EBAY_CLIENT_SECRET')
  if (!config.runame) missing.push('EBAY_RUNAME')
  if (!Array.isArray(config.scopes) || !config.scopes.length) missing.push('EBAY_OAUTH_SCOPES')

  return {
    ok: missing.length === 0,
    missing,
    config
  }
}

export function buildEbayConsentUrl({ state, config = resolveEbayOAuthConfig() }) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.runame,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state: String(state || '').trim(),
    prompt: 'login'
  })
  return `${config.authBaseUrl}?${params.toString()}`
}

export async function exchangeEbayAuthorizationCode(code, config = resolveEbayOAuthConfig()) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(code || '').trim(),
    redirect_uri: config.runame
  })

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`, 'utf8').toString('base64')
  const response = await axios.post(config.tokenUrl, body.toString(), {
    timeout: 20_000,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`
    }
  })

  return normalizeTokenPayload(response.data)
}

export async function refreshEbayAccessToken(refreshToken, config = resolveEbayOAuthConfig()) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: String(refreshToken || '').trim(),
    scope: config.scopes.join(' ')
  })

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`, 'utf8').toString('base64')
  const response = await axios.post(config.tokenUrl, body.toString(), {
    timeout: 20_000,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`
    }
  })

  return normalizeTokenPayload(response.data)
}

function normalizeTokenPayload(payload = {}) {
  const expiresInSeconds = Number(payload.expires_in || 0)
  const refreshTokenExpiresInSeconds = Number(payload.refresh_token_expires_in || 0)
  const now = Date.now()

  return {
    accessToken: String(payload.access_token || '').trim(),
    refreshToken: String(payload.refresh_token || '').trim(),
    tokenType: String(payload.token_type || '').trim(),
    scope: String(payload.scope || '').trim(),
    expiresAt: expiresInSeconds > 0 ? new Date(now + (expiresInSeconds * 1000)).toISOString() : null,
    refreshTokenExpiresAt: refreshTokenExpiresInSeconds > 0
      ? new Date(now + (refreshTokenExpiresInSeconds * 1000)).toISOString()
      : null,
    raw: payload
  }
}

export function resolveFrontendReturnUrl(req, suffix = '') {
  const explicitBase = String(process.env.FRONTEND_BASE_URL || '').trim()
  const origin = explicitBase || `${req.protocol}://${req.get('host')}`
  return `${origin}${suffix}`
}
