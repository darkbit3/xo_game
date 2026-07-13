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
  const authScreen = document.getElementById('authScreen')
  const appWrapper = document.getElementById('appWrapper')
  if (authScreen) authScreen.classList.remove('hidden')
  if (appWrapper) appWrapper.classList.add('hidden')
  showUnauthorizedPopup()
}

function showAppScreen() {
  const authScreen = document.getElementById('authScreen')
  const appWrapper = document.getElementById('appWrapper')
  if (authScreen) authScreen.classList.add('hidden')
  if (appWrapper) appWrapper.classList.remove('hidden')
}

function showUnauthorizedPopup() {
  if (document.getElementById('unauthorizedPopup')) return
  const overlay = document.createElement('div')
  overlay.id = 'unauthorizedPopup'
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:10000',
    'display:grid',
    'place-items:center',
    'background:rgba(10,14,26,0.96)',
    'padding:24px'
  ].join(';')

  overlay.innerHTML = `
    <div style="max-width:480px;width:100%;background:#0f172a;color:#f8fafc;padding:32px;border-radius:28px;box-shadow:0 32px 80px rgba(0,0,0,0.35);text-align:center;font-family:Inter,system-ui,sans-serif;">
      <div style="font-size:2rem;font-weight:800;margin-bottom:16px;">Unauthorized</div>
      <p style="margin:0 0 24px;color:#cbd5e1;line-height:1.6;">This app requires a valid token, username, phone number, and balance to continue. Please authenticate or open the app with valid credentials.</p>
      <button id="unauthRetryBtn" style="padding:12px 20px;border-radius:14px;background:#2563eb;color:#fff;border:none;font-size:1rem;cursor:pointer;">Retry</button>
    </div>
  `

  document.body.appendChild(overlay)
  document.body.style.overflow = 'hidden'
  const retryBtn = document.getElementById('unauthRetryBtn')
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      overlay.remove()
      document.body.style.overflow = ''
      window.location.reload()
    })
  }
}

function authSuccess(data) {
  setAuthData(data)
  showAppScreen()

  function callAppReady() {
    if (typeof window.appReady === 'function') {
      window.appReady()
      return
    }
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', callAppReady, { once: true })
    } else {
      window.requestAnimationFrame(callAppReady)
    }
  }

  callAppReady()
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

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', handleAuthNavigation)
} else {
  handleAuthNavigation()
}
window.addEventListener('popstate', handleAuthNavigation)
window.addEventListener('pageshow', handleAuthNavigation)
