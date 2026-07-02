/*
  Authorization regression smoke suite (DEV/QA)
  Usage:
    node scripts/regressionAuthz.mjs
    BASE_URL=http://localhost:3001 node scripts/regressionAuthz.mjs
*/

const baseUrl = String(process.env.BASE_URL || 'http://localhost:3001').replace(/\/$/, '')

function logResult(name, ok, detail = '') {
  const state = ok ? 'PASS' : 'FAIL'
  console.log(`[${state}] ${name}${detail ? ` :: ${detail}` : ''}`)
  return { name, ok, detail }
}

async function requestJson(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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

async function main() {
  const results = []

  const health = await fetch(`${baseUrl}/health`)
  results.push(logResult('health', health.ok, `status=${health.status}`))

  // Unauthenticated mutation checks (should all be 401 now)
  {
    const { res } = await requestJson('/inventory/bulk', {
      method: 'POST',
      body: JSON.stringify({
        sport: 'Football',
        cards: [{ name: 'Authz Probe', set: 'Probe Set', year: '2026', cardNumber: '1', quantity: 1 }]
      })
    })
    results.push(logResult('unauth_inventory_bulk_rejected', res.status === 401, `status=${res.status}`))
  }

  {
    const { res } = await requestJson('/catalog/templates', {
      method: 'POST',
      body: JSON.stringify({ name: 'Authz Probe Template', templateType: 'single' })
    })
    results.push(logResult('unauth_catalog_template_create_rejected', res.status === 401, `status=${res.status}`))
  }

  {
    const { res } = await requestJson('/catalog/sets', {
      method: 'POST',
      body: JSON.stringify({ sport: 'Football', year: '2026', brand: 'Probe', setName: 'Probe Set' })
    })
    results.push(logResult('unauth_catalog_set_create_rejected', res.status === 401, `status=${res.status}`))
  }

  {
    const { res } = await requestJson('/catalog/checklist/bulk', {
      method: 'POST',
      body: JSON.stringify({
        set: { sport: 'Football', year: '2026', brand: 'Probe', setName: 'Checklist Probe' },
        cards: [{ cardNumber: '1', player: 'Probe Player', team: 'Probe Team' }]
      })
    })
    results.push(logResult('unauth_catalog_checklist_bulk_rejected', res.status === 401, `status=${res.status}`))
  }

  {
    const { res } = await requestJson('/inventory/pricing/estimate-batch', {
      method: 'POST',
      body: JSON.stringify({
        cards: [{
          sport: 'Football',
          name: 'Authz Probe',
          team: 'Authz Team',
          set: 'Authz Set',
          year: '2026',
          cardNumber: '1',
          parallel: 'Base'
        }]
      })
    })
    results.push(logResult('unauth_pricing_estimate_rejected', res.status === 401, `status=${res.status}`))
  }

  {
    const { templates } = await (async () => {
      const { data } = await requestJson('/catalog/templates', { method: 'GET', headers: {} })
      return { templates: Array.isArray(data?.items) ? data.items : [] }
    })()

    const templateId = String(templates[0]?.id || '').trim()
    if (!templateId) {
      results.push(logResult('template_available_for_draft_probe', false, 'no template id found'))
    } else {
      const { res } = await requestJson('/catalog/listing-draft', {
        method: 'POST',
        body: JSON.stringify({ templateId, cardRef: 'SKU-000007' })
      })
      results.push(logResult('unauth_listing_draft_rejected', res.status === 401, `status=${res.status}`))

      const submit = await requestJson('/catalog/listing-submit', {
        method: 'POST',
        body: JSON.stringify({ templateId, cardRef: 'SKU-000007' })
      })
      results.push(logResult('unauth_listing_submit_rejected', submit.res.status === 401, `status=${submit.res.status}`))
    }
  }

  // Authenticated path should still work
  const signupEmail = `authz.regression.${Date.now()}@example.com`
  const signup = await requestJson('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ displayName: 'Authz Regression', email: signupEmail, password: 'CardPilot!2027' })
  })

  const token = String(signup.data?.token || '').trim()
  results.push(logResult('auth_signup_token', Boolean(token), `status=${signup.res.status}`))

  if (token) {
    const headers = { Authorization: `Bearer ${token}` }

    const createTpl = await requestJson('/catalog/templates', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Authz Template ${Date.now()}`,
        templateType: 'single',
        ebayFormat: 'FixedPrice',
        defaults: { quantity: 1 }
      })
    })
    results.push(logResult('auth_catalog_template_create_ok', createTpl.res.ok, `status=${createTpl.res.status}`))

    const inv = await requestJson('/inventory/bulk', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sport: 'Football',
        cards: [{
          sku: `AUTHTEST-${Date.now()}`,
          name: 'Authz Player',
          team: 'Authz Team',
          set: 'Authz Set',
          year: '2026',
          cardNumber: '77',
          quantity: 1,
          parallel: 'Base'
        }]
      })
    })
    results.push(logResult('auth_inventory_bulk_ok', inv.res.ok, `status=${inv.res.status}`))

    const pricing = await requestJson('/inventory/pricing/estimate-batch', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cards: [{
          sport: 'Football',
          name: 'Authz Player',
          team: 'Authz Team',
          set: 'Authz Set',
          year: '2026',
          cardNumber: '77',
          parallel: 'Base'
        }]
      })
    })
    results.push(logResult('auth_pricing_estimate_ok', pricing.res.ok, `status=${pricing.res.status}`))
  }

  const failed = results.filter((entry) => !entry.ok)
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    console.log('Failures:')
    failed.forEach((entry) => console.log(`- ${entry.name}: ${entry.detail}`))
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('Authz regression script failed:', err)
  process.exit(1)
})
