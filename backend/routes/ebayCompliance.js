import express from 'express'
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'

const router = express.Router()
const notificationsDir = path.join(process.cwd(), 'logs', 'ebay-notifications')

function resolveConfiguredEndpoint(req) {
  const explicit = String(process.env.EBAY_ACCOUNT_DELETION_ENDPOINT || '').trim()
  if (explicit) return explicit
  return `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`
}

function buildChallengeResponse(challengeCode, verificationToken, endpoint) {
  return createHash('sha256')
    .update(`${challengeCode}${verificationToken}${endpoint}`, 'utf8')
    .digest('hex')
}

router.get('/marketplace-account-deletion', (req, res) => {
  const challengeCode = String(req.query.challenge_code || '').trim()
  const verificationToken = String(process.env.EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN || '').trim()
  const endpoint = resolveConfiguredEndpoint(req)

  if (!challengeCode) {
    return res.status(200).json({
      status: 'ready',
      endpoint,
      challengeParam: 'challenge_code'
    })
  }

  if (!verificationToken) {
    return res.status(500).json({ error: 'EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN is not configured.' })
  }

  const challengeResponse = buildChallengeResponse(challengeCode, verificationToken, endpoint)
  return res.json({ challengeResponse })
})

router.post('/marketplace-account-deletion', (req, res) => {
  try {
    fs.mkdirSync(notificationsDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const payload = {
      receivedAt: new Date().toISOString(),
      headers: req.headers,
      body: req.body || null
    }
    fs.writeFileSync(
      path.join(notificationsDir, `${timestamp}.json`),
      JSON.stringify(payload, null, 2),
      'utf8'
    )
  } catch (err) {
    console.error('Failed to persist eBay account deletion notification:', err)
  }

  return res.status(200).json({ status: 'accepted' })
})

export default router
