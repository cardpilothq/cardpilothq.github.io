const CONFIDENCE_RANK = {
  High: 3,
  Medium: 2,
  Low: 1
}

function normalizeYear(value) {
  const match = String(value || '').match(/\b(19\d{2}|20\d{2})\b/)
  return match ? match[1] : null
}

function normalizeParallel(parallel) {
  if (!parallel) return null
  if (typeof parallel === 'string') return parallel.trim() || null

  const name = String(parallel.name || '').trim()
  const numberedTo = parallel.numberedTo || parallel.numbered_to
  if (name && numberedTo) return `${name} /${numberedTo}`
  return name || null
}

function normalizePosition(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const compactMap = {
    quarterback: 'QB',
    qb: 'QB',
    widereceiver: 'WR',
    wr: 'WR',
    runningback: 'RB',
    rb: 'RB',
    tightend: 'TE',
    te: 'TE',
    linebacker: 'LB',
    lb: 'LB',
    cornerback: 'CB',
    cb: 'CB',
    safety: 'S',
    s: 'S',
    strongsafety: 'SS',
    ss: 'SS',
    freesafety: 'FS',
    fs: 'FS',
    defensivelineman: 'DL',
    dl: 'DL',
    defensiveend: 'DE',
    de: 'DE',
    defensivetackle: 'DT',
    dt: 'DT',
    offensiveline: 'OL',
    ol: 'OL',
    offensivetackle: 'OT',
    ot: 'OT',
    offensiveguard: 'OG',
    og: 'OG',
    center: 'C',
    c: 'C',
    kicker: 'K',
    k: 'K',
    punter: 'P',
    p: 'P',
    fullback: 'FB',
    fb: 'FB'
  }

  const tokenized = raw.toLowerCase().split(/[\s/|,;()\-]+/).filter(Boolean)
  for (const token of tokenized) {
    const canonical = compactMap[token]
    if (canonical) return canonical
  }

  const compact = raw.toLowerCase().replace(/[^a-z]/g, '')
  return compactMap[compact] || null
}

function confidenceScore(value) {
  return CONFIDENCE_RANK[String(value || '').trim()] || 0
}

function pickBestDetection(detections) {
  if (!Array.isArray(detections) || !detections.length) return null
  return [...detections].sort((left, right) => {
    const confidenceDelta = confidenceScore(right?.confidence) - confidenceScore(left?.confidence)
    if (confidenceDelta !== 0) return confidenceDelta
    return 0
  })[0]
}

export function parseCardSightResult(raw) {
  const detections = Array.isArray(raw?.detections) ? raw.detections : []
  const best = pickBestDetection(detections)
  const card = best?.card || {}

  return {
    player: String(card?.name || '').trim() || null,
    team: String(card?.team || card?.teamName || '').trim() || null,
    position: normalizePosition(card?.position),
    set: String(card?.setName || card?.releaseName || '').trim() || null,
    year: normalizeYear(card?.year),
    cardNumber: String(card?.number || card?.cardNumber || '').trim() || null,
    parallel: normalizeParallel(card?.parallel),
    providerConfidence: String(best?.confidence || '').trim() || null,
    providerDetectionCount: detections.length
  }
}

export function buildCardSightPreview(raw) {
  const detections = Array.isArray(raw?.detections) ? raw.detections : []
  if (!detections.length) return ''

  const snippets = detections.slice(0, 3).map((detection) => {
    const card = detection?.card || {}
    const bits = [
      card?.year,
      card?.setName || card?.releaseName,
      card?.name,
      card?.number ? `#${card.number}` : null,
      detection?.confidence ? `(${detection.confidence})` : null
    ].filter(Boolean)

    return bits.join(' ')
  }).filter(Boolean)

  return snippets.join(' | ').slice(0, 700)
}
