// Server Status and Control
let serverCheckInterval = null
let isServerRunning = false
const MANAGER_URL = 'http://localhost:3333'
const SERVER_CONTROL_PORTS = [3000, 3001, 3002]
let backendBaseUrl = null
let startupInProgress = false
const HEALTH_TIMEOUT_MS = 700
const MANAGER_TIMEOUT_MS = 1500
let configuredBackendUrl = null

function isHostedEnvironment() {
  if (typeof window === 'undefined') return false
  const protocol = String(window.location?.protocol || '').toLowerCase()
  const host = String(window.location?.hostname || '').toLowerCase()
  if (!/^https?:$/.test(protocol)) return false
  return host !== 'localhost' && host !== '127.0.0.1'
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url, options = {}, timeoutMs = HEALTH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

async function getConfiguredBackendUrl() {
  if (configuredBackendUrl !== null) return configuredBackendUrl
  try {
    const response = await fetchWithTimeout('config.json', { method: 'GET' }, HEALTH_TIMEOUT_MS)
    if (!response.ok) {
      configuredBackendUrl = ''
      return configuredBackendUrl
    }
    const data = await response.json()
    configuredBackendUrl = String(data?.backendUrl || '').trim()
    return configuredBackendUrl
  } catch {
    configuredBackendUrl = ''
    return configuredBackendUrl
  }
}

async function detectRunningBackendUrl() {
  const configuredUrl = await getConfiguredBackendUrl()
  if (configuredUrl) {
    try {
      const response = await fetchWithTimeout(`${configuredUrl}/health`, { method: 'GET' }, HEALTH_TIMEOUT_MS)
      if (response.ok) return configuredUrl
    } catch {
      // Fall through to additional checks.
    }
  }

  if (typeof window !== 'undefined' && /^https?:/i.test(String(window.location?.origin || ''))) {
    try {
      const response = await fetchWithTimeout(`${window.location.origin}/health`, { method: 'GET' }, HEALTH_TIMEOUT_MS)
      if (response.ok) return window.location.origin
    } catch {
      // Fall back to localhost probes for local desktop use.
    }
  }

  if (isHostedEnvironment()) {
    return null
  }

  const checks = SERVER_CONTROL_PORTS.map(async (port) => {
    const baseUrl = `http://localhost:${port}`
    try {
      const response = await fetchWithTimeout(`${baseUrl}/health`, { method: 'GET' }, HEALTH_TIMEOUT_MS)
      return response.ok ? baseUrl : null
    } catch {
      return null
    }
  })

  const results = await Promise.all(checks)
  return results.find(Boolean) || null
}

async function checkServerStatus() {
  const runningUrl = await detectRunningBackendUrl()
  backendBaseUrl = runningUrl
  return Boolean(runningUrl)
}

async function checkManagerStatus() {
  try {
    const response = await fetchWithTimeout(`${MANAGER_URL}/api/server/status`, { method: 'GET' }, MANAGER_TIMEOUT_MS)
    const data = await response.json()
    return data.running
  } catch (err) {
    return false
  }
}

async function startServer() {
  try {
    const response = await fetchWithTimeout(`${MANAGER_URL}/api/server/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, MANAGER_TIMEOUT_MS)
    const data = await response.json()
    if (!data.success && !data.running) return false

    // Backend startup can take a moment. Poll for a healthy port.
    for (let i = 0; i < 8; i += 1) {
      const runningUrl = await detectRunningBackendUrl()
      if (runningUrl) {
        backendBaseUrl = runningUrl
        return true
      }
      await sleep(300)
    }

    return false
  } catch (err) {
    console.error('Failed to start server:', err)
    return false
  }
}

async function stopServer() {
  try {
    const response = await fetchWithTimeout(`${MANAGER_URL}/api/server/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, MANAGER_TIMEOUT_MS)
    const data = await response.json()
    return data.success
  } catch (err) {
    console.error('Failed to stop server:', err)
    return false
  }
}

async function updateServerStatus() {
  const isRunning = await checkServerStatus()
  const statusDot = document.getElementById('statusDot')
  const statusText = document.getElementById('statusText')
  const serverToggleBtn = document.getElementById('serverToggleBtn')
  const isHostedApp = isHostedEnvironment()
  
  isServerRunning = isRunning
  
  if (isRunning) {
    statusDot.classList.add('running')
    statusText.textContent = backendBaseUrl ? `Server Running (${backendBaseUrl})` : 'Server Running'
    if (isHostedApp) {
      serverToggleBtn.textContent = 'Hosted Mode'
      serverToggleBtn.disabled = true
      serverToggleBtn.classList.add('running')
    } else {
      serverToggleBtn.textContent = 'Stop Server'
      serverToggleBtn.disabled = false
      serverToggleBtn.classList.add('running')
    }
  } else {
    statusDot.classList.remove('running')
    statusText.textContent = isHostedApp ? 'Backend Unreachable' : 'Server Offline'
    serverToggleBtn.textContent = isHostedApp ? 'Hosted Mode' : 'Start Server'
    serverToggleBtn.disabled = isHostedApp
    serverToggleBtn.classList.remove('running')
  }
}

async function autoStartBackendOnLoad() {
  if (startupInProgress) return
  startupInProgress = true

  if (isHostedEnvironment()) {
    await updateServerStatus()
    startupInProgress = false
    return
  }

  const statusText = document.getElementById('statusText')
  const alreadyRunning = await checkServerStatus()
  if (alreadyRunning) {
    await updateServerStatus()
    startupInProgress = false
    return
  }

  statusText.textContent = 'Starting backend...'
  const started = await startServer()
  if (!started) {
    statusText.textContent = 'Server Offline (manager unavailable)'
  }

  await updateServerStatus()
  startupInProgress = false
}

document.getElementById('serverToggleBtn').addEventListener('click', async () => {
  const btn = document.getElementById('serverToggleBtn')
  const statusText = document.getElementById('statusText')
  btn.disabled = true
  btn.style.opacity = '0.6'
  
  try {
    if (isServerRunning) {
      // Stop server
      statusText.textContent = 'Stopping...'
      console.log('Stopping server...')
      await stopServer()
    } else {
      // Start server
      statusText.textContent = 'Starting...'
      console.log('Starting server...')
      await startServer()
    }
    
    // Wait for the action to complete and status to update
    await new Promise(r => setTimeout(r, 2500))
    await updateServerStatus()
  } catch (err) {
    console.error('Error:', err)
    statusText.textContent = 'Error'
  } finally {
    btn.disabled = false
    btn.style.opacity = '1'
  }
})

// Check status on load
autoStartBackendOnLoad()

// Check status every 3 seconds
serverCheckInterval = setInterval(updateServerStatus, 3000)
