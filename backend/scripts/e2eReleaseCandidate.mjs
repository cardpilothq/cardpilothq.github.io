/*
  Release-candidate E2E smoke (cost-aware).
  Validates auth -> inventory -> pricing -> listing draft -> listing submit.

  Usage:
    node scripts/e2eReleaseCandidate.mjs
    BASE_URL=http://localhost:3000 node scripts/e2eReleaseCandidate.mjs
*/

import fs from 'fs/promises'
import path from 'path'

const baseUrl = String(process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function headersWithAuth(token = '') {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function requestJson(endpoint, options = {}) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      ...(options.headers || {})
    }
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  return { res, data }
}

function assertOk(step, condition, context = {}) {
  return {
    step,
    ok: Boolean(condition),
    context
  }
}

async function writeReport(report) {
  const reportsDir = path.resolve(process.cwd(), 'data', 'reports')
  await fs.mkdir(reportsDir, { recursive: true })
  const fileName = `release-candidate-e2e-${nowStamp()}.json`
  const filePath = path.join(reportsDir, fileName)
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8')
  return { fileName, filePath }
}

async function main() {
  const runId = nowStamp()
  const email = `release.candidate.${Date.now()}@example.com`
  const password = 'CardPilot!2027'
  const sku = `RC-${Date.now()}`
  const steps = []

  const health = await fetch(`${baseUrl}/health`)
  steps.push(assertOk('health', health.ok, { status: health.status }))

  const signup = await requestJson('/auth/signup', {
    method: 'POST',
    headers: headersWithAuth(''),
    body: JSON.stringify({
      email,
      password,
      displayName: 'Release Candidate E2E'
    })
  })

  const signupToken = String(signup.data?.token || '').trim()
  steps.push(assertOk('auth_signup', signup.res.status === 201 && Boolean(signupToken), {
    status: signup.res.status,
    hasToken: Boolean(signupToken)
  }))

  const login = await requestJson('/auth/login', {
    method: 'POST',
    headers: headersWithAuth(''),
    body: JSON.stringify({ email, password })
  })

  const token = String(login.data?.token || signupToken).trim()
  steps.push(assertOk('auth_login', login.res.ok && Boolean(token), {
    status: login.res.status,
    hasToken: Boolean(token)
  }))

  const me = await requestJson('/auth/me', {
    method: 'GET',
    headers: headersWithAuth(token)
  })
  steps.push(assertOk('auth_me', me.res.ok && String(me.data?.user?.email || '').toLowerCase() === email.toLowerCase(), {
    status: me.res.status,
    userId: me.data?.user?.id || null
  }))

  const templates = await requestJson('/catalog/templates', {
    method: 'GET',
    headers: headersWithAuth('')
  })
  const templateId = String(templates.data?.items?.[0]?.id || '').trim()
  steps.push(assertOk('catalog_template_available', templates.res.ok && Boolean(templateId), {
    status: templates.res.status,
    templateId
  }))

  const invBulk = await requestJson('/inventory/bulk', {
    method: 'POST',
    headers: headersWithAuth(token),
    body: JSON.stringify({
      sport: 'Football',
      cards: [{
        SKU: sku,
        Name: 'Release Candidate Player',
        Team: 'Release Team',
        Position: 'QB',
        Set: 'Release Set',
        Year: '2026',
        CardNumber: '99',
        Quantity: 1,
        Parallel: 'Base'
      }]
    })
  })

  steps.push(assertOk('inventory_bulk', invBulk.res.ok, {
    status: invBulk.res.status,
    inserted: invBulk.data?.inserted ?? null,
    updated: invBulk.data?.updated ?? null
  }))

  const inventory = await requestJson('/inventory?sport=Football', {
    method: 'GET',
    headers: headersWithAuth(token)
  })
  const items = Array.isArray(inventory.data?.items) ? inventory.data.items : []
  const created = items.find((item) => String(item?.sku || '') === sku)
  steps.push(assertOk('inventory_list_contains_created_sku', inventory.res.ok && Boolean(created), {
    status: inventory.res.status,
    sku,
    found: Boolean(created)
  }))

  const pricing = await requestJson('/inventory/pricing/estimate-batch', {
    method: 'POST',
    headers: headersWithAuth(token),
    body: JSON.stringify({
      cards: [{
        sport: created?.sport || 'Football',
        name: created?.name || 'Release Candidate Player',
        team: created?.team || 'Release Team',
        set: created?.set || 'Release Set',
        year: created?.year || '2026',
        cardNumber: created?.cardNumber || '99',
        parallel: created?.parallel || 'Base'
      }]
    })
  })

  const estimateCount = Array.isArray(pricing.data?.estimates) ? pricing.data.estimates.length : 0
  steps.push(assertOk('inventory_pricing_estimate', pricing.res.ok && estimateCount > 0, {
    status: pricing.res.status,
    estimateCount,
    source: pricing.data?.estimates?.[0]?.source || null,
    fromCache: pricing.data?.estimates?.[0]?.fromCache ?? null
  }))

  const draft = await requestJson('/catalog/listing-draft', {
    method: 'POST',
    headers: headersWithAuth(token),
    body: JSON.stringify({
      templateId,
      cardRef: sku
    })
  })

  steps.push(assertOk('catalog_listing_draft', draft.res.ok && Boolean(draft.data?.listing?.title), {
    status: draft.res.status,
    title: draft.data?.listing?.title || null,
    listingType: draft.data?.listing?.listingType || null
  }))

  const submit = await requestJson('/catalog/listing-submit', {
    method: 'POST',
    headers: headersWithAuth(token),
    body: JSON.stringify({
      templateId,
      cardRef: sku
    })
  })

  const submissionFile = String(submit.data?.submission?.fileName || '').trim()
  steps.push(assertOk('catalog_listing_submit', submit.res.ok && Boolean(submissionFile), {
    status: submit.res.status,
    submissionFile
  }))

  const failed = steps.filter((s) => !s.ok)
  const report = {
    runId,
    generatedAt: new Date().toISOString(),
    baseUrl,
    objective: 'DEV release-candidate E2E smoke for auth/inventory/pricing/listing flow',
    costMode: 'No analyze/OCR calls; pricing endpoint exercised with a single card payload.',
    status: failed.length ? 'fail' : 'pass',
    totals: {
      passed: steps.length - failed.length,
      failed: failed.length,
      total: steps.length
    },
    steps,
    failures: failed
  }

  const saved = await writeReport(report)
  console.log(JSON.stringify({
    status: report.status,
    totals: report.totals,
    reportFile: saved.fileName,
    reportPath: saved.filePath
  }, null, 2))

  if (failed.length) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('Release-candidate E2E script failed:', err)
  process.exit(1)
})
