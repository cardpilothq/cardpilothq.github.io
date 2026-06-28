import { analyzeImage } from './azureClient.js'
import { parseAzureResult } from './azureResultParser.js'
import { identifyCardWithCardSight } from './cardsightClient.js'
import { parseCardSightResult, buildCardSightPreview } from './cardsightResultParser.js'
import { lookupPositionFromPlayer } from './playerPositionLookup.js'
import { matchCardByFields } from './cardCatalogService.js'
import { buildEnhancementVariants } from './imageEnhancer.js'

function buildPreview(rawResult) {
  return String(rawResult?.analyzeResult?.content || rawResult?.content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700)
}

function getProviderSettings() {
  const mode = String(process.env.AI_PROVIDER || 'azure').trim().toLowerCase()
  const primary = String(process.env.AI_PRIMARY_PROVIDER || (mode === 'hybrid' ? 'cardsight' : mode)).trim().toLowerCase()
  const fallback = String(process.env.AI_FALLBACK_PROVIDER || 'azure').trim().toLowerCase()
  const allowFieldFallback = ['1', 'true', 'yes'].includes(String(process.env.AI_PROVIDER_ALLOW_FIELD_FALLBACK || 'true').toLowerCase())

  if (mode !== 'hybrid') {
    return {
      mode,
      providers: [mode === 'cardsight' ? 'cardsight' : 'azure'],
      allowFieldFallback
    }
  }

  const ordered = [primary, fallback]
    .map((provider) => (provider === 'cardsight' ? 'cardsight' : 'azure'))
    .filter((provider, index, arr) => arr.indexOf(provider) === index)

  if (!ordered.length) ordered.push('azure')

  return {
    mode,
    providers: ordered,
    allowFieldFallback
  }
}

function coreFieldCount(parsed) {
  return [parsed?.player, parsed?.team, parsed?.set, parsed?.cardNumber].filter(Boolean).length
}

function shouldFallbackProvider(parsed, score) {
  const core = coreFieldCount(parsed)
  const catalogScore = Number(parsed?.catalogMatch?.score || 0)
  const normalizedScore = Number(score || 0)
  return core < 3 && catalogScore < 0.8 && normalizedScore < 4.2
}

function normalizeComparable(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function valuesLikelyMatch(left, right) {
  const a = normalizeComparable(left)
  const b = normalizeComparable(right)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

function canTrustCatalogForField(parsed, catalogBest) {
  const card = catalogBest?.card || {}
  const set = catalogBest?.set || {}
  const reasons = Array.isArray(catalogBest?.reasons) ? catalogBest.reasons : []

  const playerMatch = valuesLikelyMatch(parsed?.player, card.player)
  const teamMatch = valuesLikelyMatch(parsed?.team, card.team)
  const setMatch = valuesLikelyMatch(parsed?.set, set.setName)
  const cardNumberMatch = valuesLikelyMatch(parsed?.cardNumber, card.cardNumber)

  return {
    anyIdentityMatch: playerMatch || cardNumberMatch,
    strongIdentityMatch: playerMatch || (cardNumberMatch && teamMatch) || (cardNumberMatch && setMatch),
    allowPosition: playerMatch || reasons.includes('player_exact') || (cardNumberMatch && (teamMatch || setMatch)),
    allowParallel: playerMatch || cardNumberMatch,
    allowYear: cardNumberMatch || playerMatch || (teamMatch && setMatch),
    allowTeam: playerMatch || cardNumberMatch,
    allowSet: playerMatch || cardNumberMatch,
    allowCardNumber: playerMatch || teamMatch || setMatch
  }
}

function fillMissingFieldsFromCatalog(parsed, catalogBest) {
  if (!catalogBest) return parsed

  const next = { ...parsed }
  const card = catalogBest.card || {}
  const set = catalogBest.set || {}
  const trust = canTrustCatalogForField(parsed, catalogBest)

  if (!next.player && card.player && trust.anyIdentityMatch) next.player = card.player
  if (!next.team && card.team && trust.allowTeam) next.team = card.team
  if ((!next.position || next.position === '') && card.position && String(card.position).trim() && trust.allowPosition) next.position = card.position
  // trust.allowPosition now includes cardNumber+team/set as a valid signal
  if (!next.cardNumber && card.cardNumber && trust.allowCardNumber) next.cardNumber = card.cardNumber
  if (!next.parallel && card.parallel && String(card.parallel).trim() && trust.allowParallel) next.parallel = card.parallel
  if (!next.set && set.setName && trust.allowSet) next.set = set.setName
  if (!next.year && set.year && trust.allowYear) next.year = set.year

  return next
}

function fillPositionFromPlayerFallback(parsed) {
  const next = { ...parsed }
  if (next.position) return next

  const fallbackPosition = lookupPositionFromPlayer(next.player)
  if (fallbackPosition) {
    next.position = fallbackPosition
    next.positionSource = 'player_lookup_fallback'
  }

  return next
}

function scoreParsedCandidate(parsed, catalogBest) {
  const populatedFields = [
    parsed?.player,
    parsed?.team,
    parsed?.position,
    parsed?.set,
    parsed?.year,
    parsed?.cardNumber,
    parsed?.parallel
  ].filter(Boolean).length

  const previewScore = Math.min(0.2, String(parsed?.ocrPreview || '').length / 2000)
  const catalogScore = Math.min(1, Number(catalogBest?.score || 0))

  return Number((populatedFields + previewScore + catalogScore).toFixed(4))
}

function needsEnhancementFallback(parsed) {
  const coreFields = [parsed?.player, parsed?.team, parsed?.set, parsed?.cardNumber].filter(Boolean).length
  const catalogScore = Number(parsed?.catalogMatch?.score || 0)
  return coreFields < 3 && catalogScore < 0.85
}

function buildDiagnostics(parsed, variantName, score) {
  const keyFields = ['player', 'team', 'position', 'set', 'year', 'cardNumber', 'parallel']
  const missingFields = keyFields.filter((field) => !parsed?.[field])

  return {
    variant: variantName,
    score,
    fieldCount: keyFields.length - missingFields.length,
    missingFields,
    catalogMatchScore: Number(parsed?.catalogMatch?.score || 0),
    catalogMatched: Boolean(parsed?.catalogMatch),
    ocrPreviewLength: String(parsed?.ocrPreview || '').length
  }
}

async function runCatalogAssist(parsed, sport) {
  try {
    const fieldMatch = await matchCardByFields(
      {
        player: parsed.player,
        team: parsed.team,
        set: parsed.set,
        year: parsed.year,
        cardNumber: parsed.cardNumber,
        parallel: parsed.parallel
      },
      { sport }
    )

    const best = fieldMatch?.best || null
    const bestScore = Number(best?.score || 0)
    // Use 0.7 for general backfill; drop to 0.6 for position-only recovery
    // since position is rarely printed on card fronts.
    const meetsGeneralThreshold = bestScore >= 0.7
    const meetsPositionThreshold = bestScore >= 0.6 && !parsed?.position
    const assisted = best && (meetsGeneralThreshold || meetsPositionThreshold)
      ? fillMissingFieldsFromCatalog(parsed, best)
      : parsed

    const withPositionFallback = fillPositionFromPlayerFallback(assisted)

    return {
      parsed: { ...withPositionFallback, catalogMatch: best },
      catalogBest: best
    }
  } catch (catalogErr) {
    console.warn('Catalog assist failed:', catalogErr.message || catalogErr)
    const withPositionFallback = fillPositionFromPlayerFallback(parsed)
    return {
      parsed: { ...withPositionFallback, catalogMatch: null },
      catalogBest: null
    }
  }
}

async function analyzeWithProvider(buffer, sport, provider) {
  if (provider === 'cardsight') {
    const response = await identifyCardWithCardSight(buffer, { sport })
    const rawResult = response?.raw || {}
    const preview = buildCardSightPreview(rawResult)
    const baseParsed = parseCardSightResult(rawResult)
    const parsed = preview ? { ...baseParsed, ocrPreview: preview } : baseParsed

    return {
      parsed,
      providerMeta: response?.meta || {}
    }
  }

  const rawResult = await analyzeImage(buffer)
  const preview = buildPreview(rawResult)
  const baseParsed = parseAzureResult(rawResult)
  const parsed = preview ? { ...baseParsed, ocrPreview: preview } : baseParsed

  return {
    parsed,
    providerMeta: {
      provider: 'azure',
      skippedIdentify: false
    }
  }
}

async function analyzeSingleVariant(buffer, variantName, sport, providerSettings) {
  let firstCandidate = null
  const providerAttempts = []
  let providerFallbackReason = null

  for (let index = 0; index < providerSettings.providers.length; index += 1) {
    const provider = providerSettings.providers[index]

    try {
      const providerResult = await analyzeWithProvider(buffer, sport, provider)
      const assisted = await runCatalogAssist(providerResult.parsed, sport)
      const score = scoreParsedCandidate(assisted.parsed, assisted.catalogBest)

      const candidate = {
        variantName,
        parsed: {
          ...assisted.parsed,
          analysisProvider: provider,
          providerMeta: providerResult.providerMeta || {}
        },
        score,
        provider
      }

      providerAttempts.push({
        provider,
        score,
        coreFields: coreFieldCount(candidate.parsed),
        skippedIdentify: Boolean(candidate.parsed?.providerMeta?.skippedIdentify)
      })

      if (!firstCandidate) firstCandidate = candidate

      const isPrimary = index === 0
      const hasNext = index < providerSettings.providers.length - 1
      const allowFallback = isPrimary && hasNext && providerSettings.allowFieldFallback
      if (allowFallback && shouldFallbackProvider(candidate.parsed, score)) {
        providerFallbackReason = 'primary_low_confidence'
        continue
      }

      candidate.providerAttempts = providerAttempts
      candidate.providerFallbackReason = providerFallbackReason
      return candidate
    } catch (err) {
      providerAttempts.push({
        provider,
        error: err?.message || String(err)
      })
    }
  }

  if (firstCandidate) {
    firstCandidate.providerAttempts = providerAttempts
    firstCandidate.providerFallbackReason = providerFallbackReason
    return firstCandidate
  }

  const error = new Error('All AI providers failed for analyze variant')
  error.providerAttempts = providerAttempts
  throw error
}

export async function analyzeCardBuffer(buffer, options = {}) {
  const sport = String(options?.sport || 'Football').trim() || 'Football'
  const disableEnhancementFallback = Boolean(options?.disableEnhancementFallback)
  const providerSettings = getProviderSettings()
  const primary = await analyzeSingleVariant(buffer, 'original', sport, providerSettings)
  let bestResult = primary
  const attemptedVariants = ['original']

  if (!disableEnhancementFallback && needsEnhancementFallback(primary.parsed)) {
    const variants = await buildEnhancementVariants(buffer, ['shadowLift', 'reflectiveRecovery', 'highContrastMono'])
    const fallbackVariants = variants.filter((variant) => variant.name !== 'original')

    for (const variant of fallbackVariants) {
      attemptedVariants.push(variant.name)
      try {
        const candidate = await analyzeSingleVariant(variant.buffer, variant.name, sport, providerSettings)
        if (candidate.score > bestResult.score) {
          bestResult = candidate
        }
      } catch (variantErr) {
        console.warn(`Variant analyze failed for ${variant.name}:`, variantErr.message || variantErr)
      }
    }
  }

  const parsed = {
    ...bestResult.parsed,
    analysisVariant: bestResult.variantName,
    diagnostics: buildDiagnostics(bestResult.parsed, bestResult.variantName, bestResult.score)
  }

  parsed.diagnostics.attemptedVariants = attemptedVariants
  parsed.diagnostics.providerMode = providerSettings.mode
  parsed.diagnostics.providerOrder = providerSettings.providers
  parsed.diagnostics.providerAttempts = Array.isArray(bestResult.providerAttempts) ? bestResult.providerAttempts : []
  parsed.diagnostics.providerFallbackReason = bestResult.providerFallbackReason || null
  return parsed
}
