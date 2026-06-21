import express from 'express'
import fs from 'fs'
import path from 'path'
import axios from 'axios'

const router = express.Router()

function safeTrim(value) {
  return String(value || '').trim()
}

function clip(value, max = 4000) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n...[truncated]`
}

function readRecentErrors(limit = 25) {
  const logPath = path.join(process.cwd(), 'logs', 'analyze-errors.log')
  try {
    const raw = fs.readFileSync(logPath, 'utf8')
    const lines = raw.trim().split('\n').filter(Boolean)
    return lines
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function buildIssueBody(report, serverDiagnostics, serverErrors) {
  const reportType = report?.type === 'defect' ? 'Defect' : 'Feedback'
  const details = clip(report?.details, 12000)
  const email = safeTrim(report?.contactEmail)
  const appUrl = safeTrim(report?.app?.url)
  const sport = safeTrim(report?.app?.sport)
  const build = safeTrim(report?.app?.build)
  const browser = safeTrim(report?.client?.userAgent)
  const clientLogs = Array.isArray(report?.client?.logs) ? report.client.logs.slice(-30) : []

  return [
    `## ${reportType}`,
    '',
    details || 'No details provided.',
    '',
    '## Reporter Context',
    `- Contact: ${email || 'Not provided'}`,
    `- Sport: ${sport || 'Unknown'}`,
    `- Frontend build: ${build || 'Unknown'}`,
    `- App URL: ${appUrl || 'Unknown'}`,
    '',
    '## Browser',
    '```',
    browser || 'Unknown',
    '```',
    '',
    '## Client Logs (last 30)',
    '```json',
    JSON.stringify(clientLogs, null, 2),
    '```',
    '',
    '## Server Diagnostics Snapshot',
    '```json',
    JSON.stringify(serverDiagnostics || {}, null, 2),
    '```',
    '',
    '## Recent Backend Errors',
    '```json',
    JSON.stringify(serverErrors || [], null, 2),
    '```'
  ].join('\n')
}

async function createGitHubIssue(report, serverDiagnostics, serverErrors) {
  const token = safeTrim(process.env.FEEDBACK_GITHUB_TOKEN)
  const repo = safeTrim(process.env.FEEDBACK_GITHUB_REPO)
  if (!token || !repo || !repo.includes('/')) {
    return { created: false, reason: 'GitHub integration not configured.' }
  }

  const issueTitle = `[${report?.type === 'defect' ? 'Defect' : 'Feedback'}] ${clip(report?.title, 120) || 'Untitled report'}`
  const labelsFromEnv = safeTrim(process.env.FEEDBACK_GITHUB_LABELS)
  const labels = labelsFromEnv
    ? labelsFromEnv.split(',').map((item) => item.trim()).filter(Boolean)
    : [report?.type === 'defect' ? 'bug' : 'enhancement', 'customer-feedback']

  const issuePayload = {
    title: issueTitle,
    body: buildIssueBody(report, serverDiagnostics, serverErrors),
    labels
  }

  const response = await axios.post(
    `https://api.github.com/repos/${repo}/issues`,
    issuePayload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CardPilotHQ-Feedback-Reporter'
      },
      timeout: 10000
    }
  )

  return {
    created: true,
    issueUrl: response?.data?.html_url || '',
    issueNumber: response?.data?.number || 0
  }
}

router.post('/submit', async (req, res) => {
  const type = safeTrim(req.body?.type).toLowerCase() === 'defect' ? 'defect' : 'feedback'
  const title = safeTrim(req.body?.title)
  const details = safeTrim(req.body?.details)

  if (!title || !details) {
    return res.status(400).json({ ok: false, error: 'Title and details are required.' })
  }

  const serverDiagnostics = {
    appName: safeTrim(process.env.APP_NAME || 'CardPilot HQ'),
    environment: safeTrim(process.env.APP_ENV || process.env.NODE_ENV || 'development'),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  }
  const serverErrors = readRecentErrors(25)

  const payload = {
    type,
    title,
    details,
    contactEmail: safeTrim(req.body?.contactEmail),
    app: req.body?.app || {},
    client: req.body?.client || {},
    serverDiagnostics,
    serverErrors
  }

  const feedbackDir = path.join(process.cwd(), 'data', 'reports', 'feedback')
  fs.mkdirSync(feedbackDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = path.join(feedbackDir, `${type}-${stamp}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2), 'utf8')

  try {
    const issue = await createGitHubIssue(payload, serverDiagnostics, serverErrors)
    if (issue.created) {
      return res.json({
        ok: true,
        message: `Submitted to backlog as issue #${issue.issueNumber}.`,
        issueUrl: issue.issueUrl,
        reportPath
      })
    }

    return res.json({
      ok: true,
      message: 'Report received. GitHub issue integration is not configured yet.',
      reportPath
    })
  } catch (err) {
    return res.json({
      ok: true,
      message: 'Report received. GitHub issue creation failed, but local report was saved.',
      reportPath,
      warning: err?.message || 'Unknown GitHub API error'
    })
  }
})

export default router
