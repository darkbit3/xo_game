var API_URL = (window.__XO_BACKEND_URL__ || 'http://localhost:5000').replace(/\/$/, '')

function parseAuthQuery() {
  const params = new URLSearchParams(window.location.search)
  return {
    token: params.get('token') || '',
    phoneNumber: params.get('phoneNumber') || params.get('phone_number') || params.get('phone') || '',
    username: params.get('username') || '',
    balance: params.get('balance') || '',
  }
}

function isAuthDataValid(data) {
  return data.token && data.phoneNumber && data.username && data.balance
}

function buildAuthStorageKey(data = {}) {
  const token = String(data.token || '').trim() || 'no-token'
  const phoneNumber = String(data.phoneNumber || '').trim() || 'no-phone'
  const username = String(data.username || '').trim() || 'no-username'
  const balance = String(data.balance || '').trim() || 'no-balance'
  return `xo_auth:${token}:${phoneNumber}:${username}:${balance}`
}

function setAuthData(data) {
  window.authData = data
  const key = buildAuthStorageKey(data)
  localStorage.setItem(key, JSON.stringify(data))
  localStorage.setItem('xo_auth_current', key)
  sessionStorage.setItem('xo_auth_current', key)
}

function getStoredAuth(data = {}) {
  try {
    const key = buildAuthStorageKey(data)
    const directRaw = localStorage.getItem(key)
    if (directRaw) return JSON.parse(directRaw)

    const currentKey = localStorage.getItem('xo_auth_current') || sessionStorage.getItem('xo_auth_current')
    if (currentKey) {
      const currentRaw = localStorage.getItem(currentKey)
      if (currentRaw) return JSON.parse(currentRaw)
    }

    const legacyRaw = localStorage.getItem('xo_auth')
    return legacyRaw ? JSON.parse(legacyRaw) : null
  } catch {
    return null
  }
}

function showNotAllowedScreen() {
  document.getElementById('authScreen').classList.remove('hidden')
  document.getElementById('appWrapper').classList.add('hidden')
}

function showAppScreen() {
  document.getElementById('authScreen').classList.add('hidden')
  document.getElementById('appWrapper').classList.remove('hidden')
}

function authSuccess(data) {
  setAuthData(data)
  showAppScreen()
  if (typeof window.appReady === 'function') {
    window.appReady()
  }
}

async function resolveAuthFromBackend(data) {
  if (!data.token || !data.phoneNumber) {
    return null
  }

  try {
    const response = await fetch(`${API_URL}/api/tokens/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: data.token, phoneNumber: data.phoneNumber }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.error || 'Could not resolve auth')
    }

    return {
      token: data.token,
      phoneNumber: data.phoneNumber,
      username: payload.username || data.username || '',
      balance: payload.balance ?? data.balance ?? '',
    }
  } catch (error) {
    console.error('Auth resolution failed', error)
    return null
  }
}

async function initAuth() {
  const queryData = parseAuthQuery()
  if (isAuthDataValid(queryData)) {
    authSuccess(queryData)
    return
  }

  const needsResolution = Boolean(queryData.token && queryData.phoneNumber && (!queryData.username || !queryData.balance))
  if (needsResolution) {
    const resolved = await resolveAuthFromBackend(queryData)
    if (resolved && isAuthDataValid(resolved)) {
      authSuccess(resolved)
      return
    }
  }

  const stored = getStoredAuth(queryData)
  if (stored && isAuthDataValid(stored)) {
    authSuccess(stored)
    return
  }

  showNotAllowedScreen()
}

function handleAuthNavigation() {
  initAuth()
}

window.addEventListener('DOMContentLoaded', handleAuthNavigation)
window.addEventListener('popstate', handleAuthNavigation)
window.addEventListener('pageshow', handleAuthNavigation)
