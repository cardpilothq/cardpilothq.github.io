const baseUrl = String(process.env.CARDSIGHT_BASE_URL || 'https://api.cardsight.ai').replace(/\/+$/, '')
const apiKey = String(process.env.CARDSIGHT_API_KEY || '').trim()
const timeoutMs = Number(process.env.CARDSIGHT_TIMEOUT_MS || 30_000)
const useFreePreflight = ['1', 'true', 'yes'].includes(String(process.env.CARDSIGHT_USE_FREE_PREFLIGHT || 'true').toLowerCase())

function toSegment(sport) {
  const normalized = String(sport || '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized.includes('football')) return 'football'
  if (normalized.includes('basketball')) return 'basketball'
  if (normalized.includes('baseball')) return 'baseball'
  if (normalized.includes('hockey')) return 'hockey'
  if (normalized.includes('soccer')) return 'soccer'
  return ''
}

function requireApiKey() {
  if (!apiKey) {
    throw new Error('CardSight API key missing. Set CARDSIGHT_API_KEY for cardsight/hybrid modes.')
  }
}

async function postMultipart(pathname, buffer) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const form = new FormData()
    const blob = new Blob([buffer], { type: 'image/jpeg' })
    form.append('image', blob, 'card.jpg')

    const response = await fetch(`${baseUrl}${pathname}`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey
      },
      body: form,
      signal: controller.signal
    })

    const text = await response.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { raw: text }
    }

    if (!response.ok) {
      const err = new Error(`CardSight request failed (${response.status})`)
      err.status = response.status
      err.data = data
      throw err
    }

    return {
      status: response.status,
      headers: response.headers,
      data
    }
  } finally {
    clearTimeout(timer)
  }
}

async function detectCard(buffer) {
  try {
    const response = await postMultipart('/v1/detect/card', buffer)
    return response.data
  } catch (err) {
    if (Number(err?.status) === 404) {
      const fallback = await postMultipart('/v1/identify/card/detect', buffer)
      return fallback.data
    }
    throw err
  }
}

function detectHasCard(detectResponse) {
  if (!detectResponse || typeof detectResponse !== 'object') return true
  if (typeof detectResponse.detected === 'boolean') return detectResponse.detected
  if (typeof detectResponse.count === 'number') return detectResponse.count > 0
  return true
}

export async function identifyCardWithCardSight(buffer, options = {}) {
  requireApiKey()

  const sport = String(options?.sport || '').trim()
  const segment = toSegment(sport)

  let preflight = null
  if (useFreePreflight) {
    preflight = await detectCard(buffer)
    if (!detectHasCard(preflight)) {
      return {
        raw: { success: true, detections: [], requestId: null, preflight },
        meta: {
          provider: 'cardsight',
          preflight,
          skippedIdentify: true,
          skipReason: 'no_card_detected'
        }
      }
    }
  }

  const identifyPath = segment
    ? `/v1/identify/card/${encodeURIComponent(segment)}`
    : '/v1/identify/card'

  const response = await postMultipart(identifyPath, buffer)
  const requestId = response.headers.get('x-request-id') || response.data?.requestId || null

  return {
    raw: response.data,
    meta: {
      provider: 'cardsight',
      requestId,
      preflight,
      skippedIdentify: false
    }
  }
}
