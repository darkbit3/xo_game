// ─────────────────────────────────────────
//  DOM REFERENCES
// ─────────────────────────────────────────
const dashboardScreen   = document.getElementById('dashboardScreen');
const gameScreen        = document.getElementById('gameScreen');
const backButton        = document.getElementById('backButton');
const resetButton       = document.getElementById('resetButton');

const cells             = Array.from(document.querySelectorAll('.cell'));
const statusText        = document.getElementById('statusText');
const turnIndicator     = document.getElementById('turnIndicator');
const turnDot           = turnIndicator.querySelector('.turn-dot');

const playerXEl         = document.getElementById('playerX');
const playerOEl         = document.getElementById('playerO');
const scoreXEl          = document.getElementById('scoreX');
const scoreOEl          = document.getElementById('scoreO');
const opponentNameEl    = document.getElementById('opponentName');

const resultOverlay     = document.getElementById('resultOverlay');
const resultMessage     = document.getElementById('resultMessage');
const resultEmoji       = document.getElementById('resultEmoji');
const resultSub         = document.getElementById('resultSub');
const resultBetAmount   = document.getElementById('resultBetAmount');
const resultBetOutcome  = document.getElementById('resultBetOutcome');
const resultBetRow      = document.getElementById('resultBetRow');
const closeModalButton  = document.getElementById('closeModalButton');
const modalHomeButton   = document.getElementById('modalHomeButton');
const inviteModalOverlay = document.getElementById('inviteModalOverlay');
const inviteModalTitle  = document.getElementById('inviteModalTitle');
const inviteModalMessage = document.getElementById('inviteModalMessage');
const inviteAcceptButton = document.getElementById('inviteAcceptButton');
const inviteDeclineButton = document.getElementById('inviteDeclineButton');

inviteAcceptButton?.addEventListener('click', async () => {
  if (!pendingInvite) return;
  await acceptLiveChallenge(pendingInvite.id);
});

inviteDeclineButton?.addEventListener('click', async () => {
  if (!pendingInvite) return;
  const id = pendingInvite.id;
  hideInviteModal();
  try {
    await fetch(`${API_URL}/api/live/challenges/${id}/decline`, { method: 'POST' });
  } catch (e) {
    console.error('Could not send decline', e);
  }
});

// Sidebar
const sidebar           = document.getElementById('sidebar');
const sidebarToggle     = document.getElementById('sidebarToggle');
const sidebarClose      = document.getElementById('sidebarClose');
const sidebarOverlay    = document.getElementById('sidebarOverlay');
const topbarName        = document.querySelector('.topbar-name');
const topbarBalance     = document.querySelector('.topbar-balance');
const avatarEl          = document.querySelector('.avatar');

// Auth helpers
function formatBalance(value) {
  const number = Number(String(value).replace(/[^0-9.\-\.]/g, ''))
  if (Number.isFinite(number)) return number.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return String(value)
}

function applyAuthData(data) {
  if (!data) return
  topbarName.textContent = formatUsername(data.username || '@player')
  topbarBalance.textContent = '💰 ' + formatBalance(data.balance) + ' ETB'
  avatarEl.textContent = (data.username || 'X').trim().charAt(0).toUpperCase() || 'X'
}

function formatUsername(value) {
  const raw = String(value || '').trim()
  return raw.startsWith('@') ? raw : `@${raw}`
}

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function getCurrentUserProfile() {
  if (currentUserProfile) return currentUserProfile
  const authUsername = window.authData?.username || ME.username
  const parsedBalance = Number.isFinite(Number(window.authData?.balance)) ? Number(window.authData.balance) : null
  currentUserProfile = {
    id: Number(window.authData?.id || 0),
    username: formatUsername(authUsername),
    initials: String(authUsername || 'P').replace(/^@/, '').slice(0, 2).toUpperCase(),
    colorClass: 'me',
    status: 'online',
    balance: parsedBalance,
  }
  return currentUserProfile
}

function getCurrentUsername() {
  return formatUsername(getCurrentUserProfile().username)
}

function showLoadingOverlay(message = 'Loading…') {
  if (!loadingOverlay) return
  if (loadingOverlayText) loadingOverlayText.textContent = message
  loadingOverlay.classList.remove('hidden')
}

function hideLoadingOverlay() {
  if (!loadingOverlay) return
  loadingOverlay.classList.add('hidden')
}

function showConnectionBanner(message = 'You are offline. Please reconnect and retry.') {
  if (!connectionBanner) return
  if (connectionBannerText) connectionBannerText.textContent = message
  connectionBanner.classList.remove('hidden')
}

function hideConnectionBanner() {
  if (!connectionBanner) return
  connectionBanner.classList.add('hidden')
}

function updateConnectionStatus() {
  if (navigator.onLine) {
    hideConnectionBanner()
    return
  }
  showConnectionBanner('You are offline. Please reconnect and retry.')
}

async function attemptReconnect() {
  showLoadingOverlay('Retrying connection…')
  try {
    const response = await fetch(`${API_URL}/api/status`, { cache: 'no-store' })
    if (response.ok) {
      hideConnectionBanner()
      await loadPlayers()
      await loadLiveChallenges()
      connectLiveStream()
      return
    }
    showConnectionBanner('Retry failed. Still offline or unreachable.')
  } catch (error) {
    console.warn('Reconnect failed', error)
    showConnectionBanner('Retry failed. Still offline or unreachable.')
  } finally {
    hideLoadingOverlay()
  }
}

// Register the current user as online in the DB.
// Called once on every app load — creates the row if new, updates status+balance if returning.
async function registerOnline() {
  const profile = getCurrentUserProfile()
  if (!profile?.username) return
  try {
    await fetch(`${API_URL}/api/players/online`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: profile.username.replace(/^@/, '').trim(),
        balance: profile.balance ?? 0,
      }),
    })
  } catch (err) {
    console.error('Could not register as online', err)
  }
}

window.appReady = async function() {
  const parsedBalance = Number.isFinite(Number(window.authData?.balance)) ? Number(window.authData.balance) : null
  currentUserProfile = {
    id: Number(window.authData?.id || 0),
    username: formatUsername(window.authData?.username || ME.username),
    initials: String(window.authData?.username || ME.username || 'P').replace(/^@/, '').slice(0, 2).toUpperCase(),
    colorClass: 'me',
    status: 'online',
    balance: parsedBalance,
  }
  if (window.authData) applyAuthData(window.authData)
  // Register this player as online FIRST so they appear in others' lists
  // before polling even starts.
  await registerOnline()
  loadPlayers()
  loadLiveChallenges()
  startLivePolling()
}

// Bet
const betDisplay        = document.getElementById('betDisplay');
const betChips          = document.getElementById('betChips');
const fallbackBackendUrl = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : `http://${window.location.hostname}:5000`;
var API_URL = (window.__XO_BACKEND_URL__ || fallbackBackendUrl).replace(/\/$/, '');

// Sidebar live stats
const sideWins          = document.getElementById('sideWins');
const sideDraws         = document.getElementById('sideDraws');
const sideLosses        = document.getElementById('sideLosses');

// ─────────────────────────────────────────
//  WINNING LINES
// ─────────────────────────────────────────
const WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

// ─────────────────────────────────────────
//  GAME STATE
// ─────────────────────────────────────────
const state = {
  board: Array(9).fill(null),
  currentPlayer: 'X',
  running: false,
  vsAI: false,
  scores: { X: 0, O: 0 },
  moveInProgress: false,
  // lifetime stats (persist across sessions via localStorage)
  stats: { wins: 0, draws: 0, losses: 0 },

  reset() {
    this.board.fill(null);
    this.currentPlayer = 'X';
    this.running = true;
    this.moveInProgress = false;
  },
};

// ─────────────────────────────────────────
//  PERSISTENT STATS
// ─────────────────────────────────────────
function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem('xo_stats') || '{}');
    state.stats.wins   = saved.wins   || 12;
    state.stats.draws  = saved.draws  || 7;
    state.stats.losses = saved.losses || 3;
  } catch { state.stats = { wins: 12, draws: 7, losses: 3 }; }
}

function saveStats() {
  localStorage.setItem('xo_stats', JSON.stringify(state.stats));
}

function renderSidebarStats() {
  sideWins.textContent   = state.stats.wins;
  sideDraws.textContent  = state.stats.draws;
  sideLosses.textContent = state.stats.losses;

  // Update progress bars
  const total = state.stats.wins + state.stats.draws + state.stats.losses || 1;
  const winBar  = document.querySelector('.win-bar');
  const drawBar = document.querySelector('.draw-bar');
  const loseBar = document.querySelector('.lose-bar');
  if (winBar)  winBar.style.width  = Math.round((state.stats.wins   / total) * 100) + '%';
  if (drawBar) drawBar.style.width = Math.round((state.stats.draws  / total) * 100) + '%';
  if (loseBar) loseBar.style.width = Math.round((state.stats.losses / total) * 100) + '%';

  // Update ring & win-rate
  const winPct = Math.round((state.stats.wins / total) * 100);
  const ringFill = document.querySelector('.ring-fill');
  const ringPct  = document.querySelector('.ring-pct');
  const winrateSub = document.querySelector('.winrate-sub');
  if (ringFill) ringFill.setAttribute('stroke-dasharray', `${winPct} 100`);
  if (ringPct)  ringPct.textContent = winPct + '%';
  if (winrateSub) winrateSub.textContent = total + ' total games';
}

// ─────────────────────────────────────────
//  BET AMOUNT — chip selector
// ─────────────────────────────────────────
let betAmount = 0;
let selectedPlayer = null; // tracks which player was picked

async function saveSelectedBet(amount) {
  const profile = getCurrentUserProfile();
  if (!profile?.username) return;
  try {
    await fetch(`${API_URL}/api/players/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: profile.username.replace(/^@/, '').trim(),
        selectedBetAmount: amount,
      }),
    });
  } catch (error) {
    console.error('Could not save selected bet', error);
  }
}

const betSelectedTag       = document.getElementById('betSelectedTag');
const playerList           = document.getElementById('playerList');
const loadingOverlay       = document.getElementById('loadingOverlay');
const loadingOverlayText   = document.getElementById('loadingOverlayText');
const connectionBanner     = document.getElementById('connectionBanner');
const connectionBannerText = document.getElementById('connectionBannerText');
const connectionRetryButton = document.getElementById('connectionRetryButton');
const selectedBanner       = document.getElementById('selectedBanner');
const sbAvatar             = document.getElementById('sbAvatar');
const sbUsername      = document.getElementById('sbUsername');
const sbStatusTxt     = document.getElementById('sbStatusTxt');
const sbBetTag        = document.getElementById('sbBetTag');
const sbCancelBtn     = document.getElementById('sbCancelBtn');
// Me (the logged-in user)
const ME = { id: 0, username: '@player', initials: 'P', colorClass: 'me', status: 'online' };
let currentUserProfile = null;
let onlinePlayers = [];
let liveChallenges = [];
let liveMatches = [];
let pendingInvite = null;
let livePollingTimer = null;
let activeMatchId = null;
let liveStream = null;
let rematchOpponentName = null;
let rematchInProgress = false;
let matchViewOpen = false;

function startLivePolling() {
  if (livePollingTimer) clearInterval(livePollingTimer)
  loadPlayers()
  loadLiveChallenges()
  loadLiveMatches()
  connectLiveStream()
  livePollingTimer = setInterval(() => {
    loadPlayers()
    loadLiveChallenges()
    if (activeMatchId) {
      loadMatchById(activeMatchId)
    } else {
      loadLiveMatches()
    }
  }, 1000)
}

function setActiveMatchId(id) {
  activeMatchId = id == null ? null : Number(id);
  try {
    if (activeMatchId) localStorage.setItem('xo_activeMatchId', String(activeMatchId));
    else localStorage.removeItem('xo_activeMatchId');
  } catch (e) { /* ignore storage errors */ }
}

function clearActiveMatchId() {
  activeMatchId = null;
  try { localStorage.removeItem('xo_activeMatchId'); } catch (e) {}
}

function stopLivePolling() {
  if (livePollingTimer) clearInterval(livePollingTimer)
  livePollingTimer = null
  if (liveStream) {
    liveStream.close()
    liveStream = null
  }
}

window.addEventListener('beforeunload', () => {
  stopLivePolling()
  // Mark this player offline immediately so they vanish from others' lists.
  // sendBeacon is the only reliable way to fire a request during tab/window close.
  const profile = getCurrentUserProfile()
  if (profile?.username) {
    const username = profile.username.replace(/^@/, '').trim()
    if (username) {
      navigator.sendBeacon(
        `${API_URL}/api/players/offline`,
        new Blob([JSON.stringify({ username })], { type: 'application/json' })
      )
      // Also attempt to forfeit active match so opponent wins when we close
      try {
        const activeId = localStorage.getItem('xo_activeMatchId')
        if (activeId) {
          navigator.sendBeacon(
            `${API_URL}/api/live/matches/${activeId}/forfeit`,
            new Blob([JSON.stringify({ username: profile.username })], { type: 'application/json' })
          )
        }
      } catch (e) {}
    }
  }
})

async function loadPlayers() {
  try {
    // Always fetch ALL non-demo online players — no server-side bet filter.
    // Filtering by selected_bet_amount is done exclusively client-side in
    // renderPlayers() so onlinePlayers always has the full, fresh picture.
    const response = await fetch(`${API_URL}/api/players`);
    if (!response.ok) throw new Error('Players unavailable');
    const data = await response.json();
    onlinePlayers = Array.isArray(data)
      ? data.filter((player) => (player.status || 'online') !== 'offline')
      : [];
    renderPlayers();
    updateOnlineCount();
  } catch (error) {
    console.error('Failed to load players', error);
    onlinePlayers = [];
    renderPlayers();
    updateOnlineCount();
    if (!navigator.onLine) {
      updateConnectionStatus();
    } else {
      showConnectionBanner('Unable to load players. Retry?')
    }
  }
}

function updateOnlineCount() {
  const countEl = document.getElementById('onlineCount');
  if (countEl) {
    const visible = onlinePlayers.filter((player) => normalizeUsername(player.username) !== normalizeUsername(getCurrentUsername())).length;
    countEl.textContent = `${visible} online`;
  }
}

async function loadLiveChallenges() {
  try {
    const response = await fetch(`${API_URL}/api/live/challenges`);
    if (!response.ok) return;
    const data = await response.json();
    liveChallenges = Array.isArray(data) ? data : [];

    // Check if any pending challenge is directed at the current user.
    // If yes — show the invite modal. This is the polling fallback path;
    // the SSE challenge_received listener handles the instant path.
    const myUsername = normalizeUsername(getCurrentUsername());
    const incomingChallenge = liveChallenges.find((c) =>
      c.status === 'pending' &&
      normalizeUsername(c.opponent_username) === myUsername
    );
    if (incomingChallenge) {
      // Only show if we're not already showing this specific invite
      if (!pendingInvite || pendingInvite.id !== incomingChallenge.id) {
        showInviteModal(incomingChallenge);
      }
    } else if (pendingInvite && !liveChallenges.some((c) => c.id === pendingInvite.id && c.status === 'pending')) {
      // The challenge was cancelled or accepted by someone else — hide the modal
      hideInviteModal();
    }
  } catch (error) {
    console.error('Failed to load live challenges', error);
  }
}

async function loadLiveMatches() {
  try {
    const response = await fetch(`${API_URL}/api/live/matches`);
    if (!response.ok) return;
    const data = await response.json();
    liveMatches = Array.isArray(data) ? data : [];

    const currentUser = normalizeUsername(getCurrentUsername());
    const activeMatch = liveMatches.find((match) => match?.status === 'active' && [normalizeUsername(match.player_x_username), normalizeUsername(match.player_o_username)].includes(currentUser));
    if (activeMatch && !activeMatchId && matchViewOpen) {
      setActiveMatchId(activeMatch.id);
      enterMatchScreen(activeMatch);
    }
  } catch (error) {
    console.error('Failed to load live matches', error);
  }
}

async function loadMatchById(matchId) {
  try {
    const response = await fetch(`${API_URL}/api/live/matches/${matchId}`);
    if (!response.ok) return;
    const match = await response.json();
    if (match?.id) {
      liveMatches = liveMatches.map((item) => item.id === match.id ? match : item);
      if (!liveMatches.some((item) => item.id === match.id)) liveMatches.push(match);
      if (match.status === 'active') {
        syncBoardFromMatch(match);
        if (activeMatchId !== match.id) {
          setActiveMatchId(match.id);
          enterMatchScreen(match);
        }
      }
    }
  } catch (error) {
    console.error('Failed to load live match', error);
  }
}

function connectLiveStream() {
  if (!window.EventSource || !getCurrentUsername()) return;
  if (liveStream) liveStream.close();

  const streamUrl = `${API_URL}/api/live/stream?username=${encodeURIComponent(getCurrentUsername())}`;
  liveStream = new EventSource(streamUrl);

  // Fired instantly when someone challenges this player — show invite modal immediately
  liveStream.addEventListener('challenge_received', (event) => {
    const payload = JSON.parse(event.data || '{}');
    if (payload?.challenge) {
      showInviteModal(payload.challenge);
      loadLiveChallenges();
    }
  });

  // Fired on the challenger side to confirm the challenge was delivered
  liveStream.addEventListener('challenge_sent', (event) => {
    const payload = JSON.parse(event.data || '{}');
    if (payload?.challenge) {
      sbStatusTxt.textContent = `Challenge sent ✓ — waiting for ${formatUsername(payload.challenge.opponent_username)} to accept…`;
      // Show an outgoing confirmation popup to the challenger
      showInviteModal(payload.challenge, { sentByMe: true });
    }
  });

  // Fired on the challenger side when the opponent declines
  liveStream.addEventListener('challenge_declined', (event) => {
    const payload = JSON.parse(event.data || '{}');
    if (payload?.challenge) {
      // Reset the challenger's selection so they can pick a new opponent
      selectedPlayer = null;
      selectedBanner.classList.add('hidden');
      sbStatusTxt.textContent = 'Ready to play ✓';
      renderPlayers();
      loadLiveChallenges();
      // Brief visual feedback
      const name = formatUsername(payload.challenge.opponent_username);
      sbStatusTxt.textContent = `${name} declined. Pick another player.`;
    }
  });

  liveStream.addEventListener('challenge_accepted', (event) => {
    const payload = JSON.parse(event.data || '{}');
    if (payload?.match?.id) {
      setActiveMatchId(payload.match.id);
      liveMatches = liveMatches.filter((match) => match.id !== payload.match.id);
      liveMatches.push(payload.match);
      enterMatchScreen(payload.match);
      loadLiveChallenges();
    }
  });
  liveStream.addEventListener('move_made', (event) => {
    const payload = JSON.parse(event.data || '{}');
    if (payload?.match?.id) {
      // Update local cache
      liveMatches = liveMatches.map((match) => match.id === payload.match.id ? payload.match : match);
      if (!liveMatches.some((match) => match.id === payload.match.id)) liveMatches.push(payload.match);

      // Only apply the incoming match to the board if the current user is a participant
      // and they are actively viewing this match (matchViewOpen) or the match is the
      // currently selected activeMatchId. This avoids applying unrelated match payloads
      // while ensuring the opponent sees confirmed moves when they're viewing the game.
      const currentUser = normalizeUsername(getCurrentUsername());
      const participantUsernames = [normalizeUsername(payload.match.player_x_username), normalizeUsername(payload.match.player_o_username)];
      const involved = participantUsernames.includes(currentUser);
      if (involved && (matchViewOpen || Number(activeMatchId) === Number(payload.match.id))) {
        syncBoardFromMatch(payload.match);
      }
    }
  });
  liveStream.addEventListener('match_finished', (event) => {
    const payload = JSON.parse(event.data || '{}');
    if (payload?.match?.id) {
      liveMatches = liveMatches.map((match) => match.id === payload.match.id ? payload.match : match);
      if (!liveMatches.some((match) => match.id === payload.match.id)) liveMatches.push(payload.match);
      if (Number(activeMatchId) === Number(payload.match.id)) {
        syncBoardFromMatch(payload.match);
        // show result modal for finished match
        showResultModalForMatch(payload.match);
      }
    }
  });
  liveStream.onerror = () => {
    if (liveStream) {
      liveStream.close();
      liveStream = null;
    }
  };
}

function enterMatchScreen(match) {
  if (!match) return;
  const currentUser = normalizeUsername(getCurrentUsername());
  const opponentName = normalizeUsername(match.player_x_username) === currentUser
    ? match.player_o_username
    : match.player_x_username;
  matchViewOpen = true;
  showGameScreen(false, opponentName);
  syncBoardFromMatch(match);
}

async function createLiveChallenge(opponentName) {
  if (!betAmount || !opponentName) return;
  const payload = {
    challengerUsername: getCurrentUsername(),
    opponentUsername: opponentName,
    wagerAmount: betAmount,
  };

  try {
    const response = await fetch(`${API_URL}/api/live/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Challenge failed');
    const challenge = await response.json();
    if (challenge) {
      sbStatusTxt.textContent = 'Challenge sent ✓';
      await loadLiveChallenges();
    }
  } catch (error) {
    console.error('Could not create challenge', error);
  }
}

let acceptChallengeInFlight = false;
async function acceptLiveChallenge(id) {
  if (acceptChallengeInFlight) {
    console.warn('[acceptLiveChallenge] already in flight, ignoring duplicate accept')
    return
  }
  acceptChallengeInFlight = true
  if (inviteAcceptButton) inviteAcceptButton.disabled = true
  try {
    const response = await fetch(`${API_URL}/api/live/challenges/${id}/accept`, {
      method: 'POST',
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.error || 'Accept failed')
    }
    const result = await response.json();
    if (result?.match) {
      hideInviteModal();
      activeMatchId = result.match.id;
      liveMatches = liveMatches.filter((match) => match.id !== result.match.id);
      liveMatches.push(result.match);
      sbStatusTxt.textContent = 'Accepted — game ready';
      await loadLiveChallenges();
      enterMatchScreen(result.match);
      await loadMatchById(result.match.id);
    }
  } catch (error) {
    console.error('Could not accept challenge', error);
  } finally {
    acceptChallengeInFlight = false
    if (inviteAcceptButton) inviteAcceptButton.disabled = false
  }
}

function showInviteModal(challenge, options = {}) {
  if (!inviteModalOverlay) return;
  pendingInvite = challenge;
  const sentByMe = options.sentByMe === true;

  const challengerName = formatUsername(challenge.challenger_username);
  const initials = String(challenge.challenger_username || 'P').replace(/^@/, '').slice(0, 2).toUpperCase();
  const wager = Number(challenge.wager_amount) || 0;

  // Update modal content dynamically
  const avatarEl = document.getElementById('inviteModalAvatar');
  const betEl = document.getElementById('inviteModalBet');

  if (sentByMe) {
    // Outgoing view for the challenger (shows requester info + Decline)
    inviteModalTitle.textContent = '⚔️ Challenge Requester!';
    inviteModalMessage.textContent = `You want to play ${formatUsername(challenge.opponent_username)} for`;
    if (avatarEl) avatarEl.textContent = String(challenge.opponent_username || '?').replace(/^@/, '').slice(0, 2).toUpperCase();
    if (betEl) betEl.textContent = `₿ ${wager} ETB`;
    if (inviteAcceptButton) inviteAcceptButton.classList.add('hidden');
    if (inviteDeclineButton) inviteDeclineButton.textContent = '✕ Decline';
  } else {
    // Incoming challenge for the recipient
    inviteModalTitle.textContent = '⚔️ Challenge Incoming!';
    inviteModalMessage.textContent = `${challengerName} wants to play you for`;
    if (avatarEl) avatarEl.textContent = initials;
    if (betEl) betEl.textContent = `₿ ${wager} ETB`;
    if (inviteAcceptButton) inviteAcceptButton.classList.remove('hidden');
    if (inviteDeclineButton) inviteDeclineButton.textContent = '✕ Decline';
  }

  inviteModalOverlay.classList.remove('hidden');
}

function hideInviteModal() {
  if (!inviteModalOverlay) return;
  pendingInvite = null;
  // Reset accept button visibility/state and decline text
  if (inviteAcceptButton) {
    inviteAcceptButton.classList.remove('hidden');
    inviteAcceptButton.disabled = false;
  }
  if (inviteDeclineButton) inviteDeclineButton.textContent = '✕ Decline';
  inviteModalOverlay.classList.add('hidden');
}

// ── Render player list ───────────────────
function renderPlayers() {
  const rows = [];
  const currentUser = normalizeUsername(getCurrentUsername());
  const visiblePlayers = onlinePlayers
    .filter((player) => normalizeUsername(player.username) !== currentUser)
    .sort((a, b) => (Number(b.balance || 0) - Number(a.balance || 0)));

  // ── Diagnostic log: shows every candidate's raw bet amount vs the current
  //    filter so any type/value mismatch is immediately visible in DevTools.
  const currentBetNum = Number(betAmount) || 0;
  /*
  if (betAmount) {
    console.log('[renderPlayers] filtering candidates against betAmount =', currentBetNum);
    visiblePlayers.forEach((player) => {
      const raw = player.selected_bet_amount ?? player.selectedBetAmount ?? null;
      const coerced = Number(raw);
      const matches = coerced === currentBetNum;
      console.log(
        `  player=${player.username} | raw_selected_bet_amount=${raw} | coerced=${coerced} | matches=${matches}`
      );
    });
  }
  */

  // Both sides are explicitly coerced with Number() to prevent string/number
  // type-mismatch false negatives. Number(null) = 0, Number('10') = 10, etc.
  const matchingPlayers = betAmount
    ? visiblePlayers.filter((player) => {
        const playerBet = Number(player.selected_bet_amount ?? player.selectedBetAmount ?? null);
        return Number.isFinite(playerBet) && playerBet > 0 && playerBet === currentBetNum;
      })
    : visiblePlayers;

  if (betAmount) {
    rows.push(buildMeRow());
  }

  if (!visiblePlayers.length) {
    // Diagnostic: nobody else is online at all (not just a bet mismatch)
    rows.push(`<div class="pl-row"><div class="pl-info"><span class="pl-username">No other players are online right now. Check back in a moment.</span></div></div>`);
  } else if (betAmount && !matchingPlayers.length) {
    // Diagnostic: others ARE online but none have selected this bet amount yet
    rows.push(`<div class="pl-row"><div class="pl-info"><span class="pl-username">${
      visiblePlayers.length
    } player(s) online — none have selected ${currentBetNum} ETB yet. Waiting for a match…</span></div></div>`);
  } else {
    const sorted = selectedPlayer
      ? [matchingPlayers.find((p) => Number(p.id) === selectedPlayer), ...matchingPlayers.filter((p) => Number(p.id) !== selectedPlayer)].filter(Boolean)
      : matchingPlayers;
    rows.push(...sorted.map((p) => buildPlayerRow(p)));
  }

  playerList.innerHTML = rows.join('');

  playerList.querySelectorAll('.play-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectPlayer(Number(btn.dataset.id), btn.dataset.opponent));
  });
  playerList.querySelectorAll('.pl-btn-cancel').forEach((btn) => {
    btn.addEventListener('click', () => cancelSelection());
  });
}

function buildMeRow() {
  const profile = getCurrentUserProfile()
  return `
    <div class="pl-row pl-row-me">
      <div class="pl-avatar me">${profile.initials}</div>
      <div class="pl-info">
        <span class="pl-username">${profile.username} <span class="you-tag">You</span></span>
        <div class="pl-badges">
          <span class="pl-badge pl-badge-bet">${betAmount ? `Bet ${betAmount} ETB` : 'No bet selected'}</span>
          <span class="pl-badge pl-badge-available">✓ Ready</span>
        </div>
      </div>
      <div class="pl-stats">
        <span class="pl-stat w">W<b>0</b></span>
        <span class="pl-stat d">D<b>0</b></span>
        <span class="pl-stat l">L<b>0</b></span>
      </div>
      <span class="status-dot dot-online"></span>
      <span class="pl-ready-tag">✓ Ready</span>
    </div>`;
}

function buildPlayerRow(p) {
  const isSelected = Number(selectedPlayer) === Number(p.id);
  const available = Number(p.balance || 0);
  const canPlay = !betAmount || available >= betAmount;
  const initials = (p.username || 'P').replace(/^@/, '').slice(0, 2).toUpperCase();
  const colorClass = ['p1', 'p2', 'p3', 'p4'][Number(p.id) % 4];

  let btnHtml;
  if (isSelected) {
    btnHtml = `<button class="pl-btn pl-btn-cancel" type="button" data-id="${p.id}">✕ Cancel</button>`;
  } else if (selectedPlayer) {
    btnHtml = `<button class="pl-btn pl-btn-waiting" type="button" disabled>Waiting…</button>`;
  } else if (!betAmount) {
    btnHtml = `<button class="pl-btn pl-btn-locked" type="button" disabled>▶ Play</button>`;
  } else if (!canPlay) {
    btnHtml = `<button class="pl-btn pl-btn-locked" type="button" disabled>Low balance</button>`;
  } else {
    btnHtml = `<button class="pl-btn play-btn" type="button" data-id="${p.id}" data-opponent="${formatUsername(p.username)}">▶ Play</button>`;
  }

  return `
    <div class="pl-row${isSelected ? ' pl-row-selected' : ''}" data-id="${p.id}">
      <div class="pl-avatar ${colorClass}">${initials}</div>
      <div class="pl-info">
        <span class="pl-username">${formatUsername(p.username)}</span>
        <div class="pl-badges">
          <span class="pl-badge pl-badge-bet">${betAmount ? `Bet ${formatBalance(betAmount)} ETB` : `Balance ${formatBalance(available)} ETB`}</span>
          <span class="pl-badge ${canPlay ? 'pl-badge-available' : 'pl-badge-low'}">${canPlay ? 'Available' : 'Low balance'}</span>
        </div>
      </div>
      <div class="pl-stats">
        <span class="pl-stat w">W<b>${Math.max(1, Number(p.id) % 10)}</b></span>
        <span class="pl-stat d">D<b>${Math.max(1, Number(p.id) % 5)}</b></span>
        <span class="pl-stat l">L<b>${Math.max(1, Number(p.id) % 7)}</b></span>
      </div>
      <span class="status-dot dot-online"></span>
      ${btnHtml}
    </div>`;
}

// ── Select a player ──────────────────────
async function selectPlayer(id, opponentName) {
  const p = onlinePlayers.find((pl) => Number(pl.id) === Number(id));
  if (!p) return;

  selectedPlayer = Number(id);
  const initials = (p.username || 'P').replace(/^@/, '').slice(0, 2).toUpperCase();
  const colorClass = ['p1', 'p2', 'p3', 'p4'][Number(p.id) % 4];

  sbAvatar.textContent      = initials;
  sbAvatar.className        = 'sb-avatar ' + colorClass;
  sbUsername.textContent    = formatUsername(p.username);
  sbBetTag.textContent      = '₿ ' + betAmount;
  sbStatusTxt.textContent   = `Waiting for ${formatUsername(p.username)} to accept…`;
  selectedBanner.classList.remove('hidden');
  renderPlayers();
  const opponentDisplayName = formatUsername(p.username);
  opponentNameEl.textContent = opponentDisplayName;
  playerOEl.querySelector('.vs-name').textContent = opponentDisplayName;
  await createLiveChallenge(opponentDisplayName);
}

// ── Cancel selection ─────────────────────
async function cancelSelection() {
  selectedPlayer = null;
  selectedBanner.classList.add('hidden');
  try {
    await fetch(`${API_URL}/api/players/bet/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: getCurrentUsername().replace(/^@/, '') }),
    });
  } catch (error) {
    console.error('Could not cancel bet', error);
  }
  betAmount = 0;
  updateBetDisplay();
  renderPlayers();
}

sbCancelBtn.addEventListener('click', cancelSelection);

async function updateBetDisplay() {
  if (!betAmount) {
    betDisplay.textContent = 'Pick amount';
    betDisplay.classList.add('unselected');
    betSelectedTag.classList.add('hidden');
    selectedPlayer = null;
    playerList.classList.remove('hidden');
    renderPlayers();
    return;
  }

  betDisplay.textContent = '₿ ' + betAmount;
  betDisplay.classList.remove('unselected');
  betDisplay.style.transform = 'scale(1.12)';
  setTimeout(() => betDisplay.style.transform = '', 180);
  betSelectedTag.textContent = '₿ ' + betAmount;
  betSelectedTag.classList.remove('hidden');
  playerList.classList.remove('hidden');
  // Save this player's bet first, THEN load the full fresh player list.
  // loadPlayers() already calls renderPlayers() internally — no extra call needed.
  await saveSelectedBet(betAmount);
  await loadPlayers();
}

betChips.addEventListener('click', async (e) => {
  const chip = e.target.closest('.bet-chip');
  if (!chip) return;
  betChips.querySelectorAll('.bet-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  betAmount = Number(chip.dataset.amount);
  await updateBetDisplay();
});

// ─────────────────────────────────────────
//  SIDEBAR TOGGLE (mobile)
// ─────────────────────────────────────────
function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

sidebarToggle.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// ─────────────────────────────────────────
//  BOARD RENDERING
// ─────────────────────────────────────────
function renderBoard() {
  const activeMatch = getActiveMatch();
  const myRole = getMyRole(activeMatch);
  const isMyTurn = state.currentPlayer === myRole;

  cells.forEach((cell, i) => {
    const val = state.board[i];
    cell.textContent = val || '';
    const locked = !state.running || Boolean(val) || (activeMatch ? !isMyTurn : false);
    cell.disabled = locked;
    cell.classList.remove('x-cell', 'o-cell', 'winner');
    if (val === 'X') cell.classList.add('x-cell');
    if (val === 'O') cell.classList.add('o-cell');
  });
}

function getActiveMatch() {
  const currentUser = normalizeUsername(getCurrentUsername());
  if (activeMatchId) {
    const matchById = liveMatches.find((match) => Number(match.id) === Number(activeMatchId));
    if (matchById) return matchById;
  }
  return liveMatches.find((match) => match?.status === 'active' && [normalizeUsername(match.player_x_username), normalizeUsername(match.player_o_username)].includes(currentUser)) || null;
}

function getMyRole(match = getActiveMatch()) {
  const currentUser = normalizeUsername(getCurrentUsername());
  if (!match) return 'X';
  return normalizeUsername(match.player_x_username) === currentUser ? 'X' : 'O';
}

function setTurnUI() {
  const isX = state.currentPlayer === 'X';
  const activeMatch = getActiveMatch();
  const myRole = getMyRole(activeMatch);
  const isMyTurn = state.currentPlayer === myRole;
  const currentUser = formatUsername(getCurrentUsername());
  const opponentName = activeMatch ? (myRole === 'X' ? formatUsername(activeMatch.player_o_username) : formatUsername(activeMatch.player_x_username)) : 'Opponent';

  playerXEl.querySelector('.vs-name').textContent = myRole === 'X' ? currentUser : opponentName;
  playerOEl.querySelector('.vs-name').textContent = myRole === 'O' ? currentUser : opponentName;
  playerXEl.classList.toggle('active-player', isX);
  playerOEl.classList.toggle('active-player', !isX);
  turnDot.className = 'turn-dot ' + (isX ? 'x-dot' : 'o-dot');

  if (activeMatch) {
    statusText.textContent = isMyTurn ? `Your turn — ${myRole}` : `Opponent's turn — ${state.currentPlayer}`;
  } else {
    statusText.textContent = isX
      ? 'Your turn — X'
      : (state.vsAI ? 'AI is thinking…' : "Opponent's turn — O");
  }
}

// ─────────────────────────────────────────
//  WIN / DRAW DETECTION
// ─────────────────────────────────────────
function checkWinner() {
  for (const [a, b, c] of WINNING_LINES) {
    if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c])
      return { player: state.board[a], line: [a, b, c] };
  }
  return null;
}
function isDraw() { return state.board.every(Boolean); }
function highlightWinners(line) { line.forEach(i => cells[i].classList.add('winner')); }

// ─────────────────────────────────────────
//  PLAY MOVE
// ─────────────────────────────────────────
async function playMove(index) {
  if (state.moveInProgress) return;
  if (!state.running || state.board[index]) return;
  const activeMatch = getActiveMatch();
  const myRole = getMyRole(activeMatch);
  if (activeMatch && state.currentPlayer !== myRole) return;

  if (activeMatch) {
    state.moveInProgress = true;
    console.log('[MOVE] tapped cell', index, 'sending to server...');
    try {
      const response = await fetch(`${API_URL}/api/live/matches/${activeMatch.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerUsername: getCurrentUsername(), index }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Move sync failed');
      }
      const responseData = await response.json();
      console.log('[MOVE] server response:', responseData);
      const updatedMatch = responseData;
      liveMatches = liveMatches.map((match) => match.id === activeMatch.id ? updatedMatch : match);
      syncBoardFromMatch(updatedMatch);
    } catch (error) {
      console.error('[MOVE] FAILED:', error.message);
    } finally {
      state.moveInProgress = false;
    }
    return;
  }

  state.board[index] = state.currentPlayer;
  renderBoard();

  const result = checkWinner();
  if (result) {
    state.running = false;
    highlightWinners(result.line);
    state.scores[result.player]++;
    updateScoreUI();

    // Update lifetime stats
    if (result.player === 'X') state.stats.wins++;
    else                        state.stats.losses++;
    saveStats(); renderSidebarStats();

    setTimeout(() => {
      const isX = result.player === 'X';
      showModal(
        isX ? '🏆' : (state.vsAI ? '🤖' : '🥇'),
        isX ? 'You Win!' : (state.vsAI ? 'AI Wins!' : 'Player O Wins!'),
        isX ? 'Outstanding move!' : 'Better luck next round!',
        isX ? '+₿ ' + betAmount : '−₿ ' + betAmount
      );
    }, 400);
    return;
  }

  if (isDraw()) {
    state.running = false;
    state.stats.draws++;
    saveStats(); renderSidebarStats();
    setTimeout(() => showModal('🤝', "It's a Draw!", 'Neck and neck — try again?', '±₿ 0'), 400);
    return;
  }

  state.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';
  setTurnUI();

  if (state.vsAI && state.currentPlayer === 'O' && state.running) {
    cells.forEach(c => c.disabled = true);
    setTimeout(doAIMove, 700);
  }
}

// ─────────────────────────────────────────
//  AI (minimax)
// ─────────────────────────────────────────
function doAIMove() {
  const best = minimax(state.board, 'O');
  playMove(best.index);
}

function minimax(board, player) {
  const result = checkWinnerOnBoard(board);
  if (result === 'O') return { score: 10 };
  if (result === 'X') return { score: -10 };
  const empty = board.map((v, i) => v ? null : i).filter(v => v !== null);
  if (empty.length === 0) return { score: 0 };

  const moves = empty.map(i => {
    board[i] = player;
    const score = minimax(board, player === 'O' ? 'X' : 'O').score;
    board[i] = null;
    return { index: i, score };
  });

  return player === 'O'
    ? moves.reduce((a, b) => b.score > a.score ? b : a)
    : moves.reduce((a, b) => b.score < a.score ? b : a);
}

function checkWinnerOnBoard(board) {
  for (const [a, b, c] of WINNING_LINES)
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return null;
}

// ─────────────────────────────────────────
//  SCORE UI
// ─────────────────────────────────────────
function updateScoreUI() {
  scoreXEl.textContent = state.scores.X;
  scoreOEl.textContent = state.scores.O;
}

function parseMatchMoves(match) {
  if (!match) return [];
  try {
    return (typeof match.moves === 'string' && match.moves ? JSON.parse(match.moves) : match.moves) || [];
  } catch (error) {
    console.error('[parseMatchMoves] could not parse moves:', error, 'match:', match);
    return [];
  }
}

function syncBoardFromMatch(match) {
  if (match) {
    console.log('[SYNC] match', match.id, '- moves count:', (match.moves ? JSON.parse(match.moves).length : 0));
  }

  const currentBoardCount = state.board.filter(Boolean).length;
  const incomingMoves = parseMatchMoves(match);

  if (!match) {
    state.board = Array(9).fill(null);
    state.currentPlayer = 'X';
    renderBoard();
    setTurnUI();
    return;
  }

  if (activeMatchId && Number(match.id) !== Number(activeMatchId)) {
    console.warn('[syncBoardFromMatch] ignoring non-active match payload', { incomingMatchId: match.id, activeMatchId });
    return;
  }

  const activeMatch = getActiveMatch();
  if (activeMatch && Number(activeMatch.id) === Number(match.id)) {
    if (incomingMoves.length < currentBoardCount) {
      console.warn('[syncBoardFromMatch] ignoring stale update: incomingMoves shorter than current board', {
        matchId: match.id,
        incomingMovesLength: incomingMoves.length,
        currentBoardCount,
      });
      return;
    }
  }

  try {
    state.board = Array(9).fill(null);
    incomingMoves.forEach((move) => {
      if (Number.isInteger(move.index) && move.index >= 0 && move.index < 9) {
        state.board[move.index] = move.player;
      }
    });
    state.currentPlayer = incomingMoves.length % 2 === 0 ? 'X' : 'O';
    if (match.status === 'finished') {
      state.running = false;
      clearActiveMatchId();
      rematchOpponentName = getOpponentNameFromMatch(match);
      rematchInProgress = false;
      showResultModalForMatch(match);
    } else {
      state.running = true;
      renderBoard();
      setTurnUI();
      updateScoreUI();
    }
    renderBoard();
    setTurnUI();
    updateScoreUI();
  } catch (error) {
    console.error('Could not parse match moves', error);
  }
}

// ─────────────────────────────────────────
//  MODAL
// ─────────────────────────────────────────
function showModal(emoji, title, sub, outcome) {
  resultEmoji.textContent   = emoji;
  resultMessage.textContent = title;
  resultSub.textContent     = sub;
  closeModalButton.textContent = '▶ Play Again';
  modalHomeButton.textContent = '⌂ Menu';

  if (betAmount) {
    resultBetAmount.textContent  = '₿ ' + betAmount;
    resultBetOutcome.textContent = outcome;
    resultBetOutcome.className   = 'result-bet-outcome ' +
      (outcome.startsWith('+') ? 'outcome-win' : outcome.startsWith('−') ? 'outcome-lose' : 'outcome-draw');
    resultBetRow.classList.remove('hidden');
  } else {
    resultBetRow.classList.add('hidden');
  }

  // spawn confetti only on win
  const confettiWrap = document.getElementById('confettiWrap');
  confettiWrap.innerHTML = '';
  if (outcome && outcome.startsWith('+')) {
    const colors = ['#3b82f6','#a855f7','#22c55e','#f59e0b','#f97316','#ec4899'];
    for (let i = 0; i < 28; i++) {
      const dot = document.createElement('span');
      dot.className = 'confetti-dot';
      dot.style.cssText = `
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 30}%;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        width: ${5 + Math.random() * 6}px;
        height: ${5 + Math.random() * 6}px;
        animation-duration: ${0.9 + Math.random() * 0.8}s;
        animation-delay: ${Math.random() * 0.4}s;
      `;
      confettiWrap.appendChild(dot);
    }
  }

  resultOverlay.classList.remove('hidden');
}
function hideModal() { resultOverlay.classList.add('hidden'); }

function getOpponentNameFromMatch(match) {
  if (!match) return 'Opponent';
  const currentUser = normalizeUsername(getCurrentUsername());
  return normalizeUsername(match.player_x_username) === currentUser
    ? match.player_o_username
    : match.player_x_username;
}

function showResultModalForMatch(match) {
  if (!match) return;
  const currentUser = normalizeUsername(getCurrentUsername());
  const currentRole = getMyRole(match);

  if (match.result === 'draw') {
    showModal('🤝', 'Draw', 'No winner this round', '±₿ 0');
    return;
  }

  const winnerMatchesCurrent = normalizeUsername(match.winner_username) === currentUser;
  if (winnerMatchesCurrent) {
    showModal('🏆', 'You Win', 'Outstanding move!', `+₿ ${betAmount || 0}`);
  } else {
    showModal('🥇', 'You Lose', 'Better luck next round!', `−₿ ${betAmount || 0}`);
  }
}

async function startPlayAgain() {
  if (!rematchOpponentName) {
    hideModal();
    startNewGame();
    return;
  }

  rematchInProgress = true;
  sbStatusTxt.textContent = 'Waiting for opponent to accept…';
  selectedBanner.classList.remove('hidden');
  sbAvatar.textContent = rematchOpponentName.replace(/^@/, '').slice(0, 2).toUpperCase();
  sbAvatar.className = 'sb-avatar p2';
  sbUsername.textContent = formatUsername(rematchOpponentName);
  sbBetTag.textContent = '₿ ' + betAmount;
  hideModal();
  await createLiveChallenge(rematchOpponentName);
}

// ─────────────────────────────────────────
//  SCREEN TRANSITIONS
// ─────────────────────────────────────────
function showGameScreen(vsAI = false, opponentName = 'Opponent') {
  state.vsAI = vsAI;
  const resolvedOpponent = vsAI ? 'AI Bot' : formatUsername(opponentName || 'Opponent');
  const currentUser = formatUsername(getCurrentUsername());
  const activeMatch = getActiveMatch();
  const myRole = activeMatch ? getMyRole(activeMatch) : 'X';

  playerXEl.querySelector('.vs-name').textContent = myRole === 'X' ? currentUser : resolvedOpponent;
  playerOEl.querySelector('.vs-name').textContent = myRole === 'O' ? currentUser : resolvedOpponent;
  opponentNameEl.textContent = resolvedOpponent;
  dashboardScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  document.body.classList.add('game-active');
  document.body.style.overflow = 'hidden';
  closeSidebar();
  startNewGame();
}

function showDashboard() {
  gameScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
  document.body.classList.remove('game-active');
  document.body.style.overflow = '';
  selectedPlayer = null;
  selectedBanner.classList.add('hidden');
  clearActiveMatchId();
  matchViewOpen = false;
  renderPlayers();
  hideModal();
  hideInviteModal();
}

function startNewGame() {
  state.reset();
  renderBoard();
  setTurnUI();
  updateScoreUI();
}

async function forfeitActiveMatch() {
  if (!activeMatchId) return;
  try {
    await fetch(`${API_URL}/api/live/matches/${activeMatchId}/forfeit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerUsername: getCurrentUsername() }),
    });
  } catch (e) {
    console.warn('Could not forfeit active match', e);
  }
}

// ─────────────────────────────────────────
//  EVENT LISTENERS
// ─────────────────────────────────────────
const playAiSidebar = document.getElementById('playAiSidebar');
if (playAiSidebar) playAiSidebar.addEventListener('click', () => showGameScreen(true));

backButton.addEventListener('click', async () => {
  await forfeitActiveMatch();
  showDashboard();
  state.scores = { X: 0, O: 0 };
});

resetButton.addEventListener('click', () => { hideModal(); startNewGame(); });

cells.forEach(cell => {
  cell.addEventListener('click', () => playMove(Number(cell.dataset.index)));
});

closeModalButton.addEventListener('click', async () => {
  if (rematchOpponentName && !rematchInProgress) {
    await startPlayAgain();
    return;
  }
  hideModal();
  startNewGame();
});

modalHomeButton.addEventListener('click', () => {
  rematchOpponentName = null;
  rematchInProgress = false;
  hideModal();
  showDashboard();
  state.scores = { X: 0, O: 0 };
});

inviteAcceptButton.addEventListener('click', () => {
  if (pendingInvite) acceptLiveChallenge(pendingInvite.id);
});

inviteDeclineButton.addEventListener('click', () => hideInviteModal());

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────
function setupTelegram() {
  if (window.Telegram?.WebApp) window.Telegram.WebApp.expand();
}

window.addEventListener('DOMContentLoaded', async () => {
  setupTelegram();
  loadStats();
  renderSidebarStats();
  updateBetDisplay();
  if (window.authData) applyAuthData(window.authData);
  updateConnectionStatus();
  connectionRetryButton?.addEventListener('click', attemptReconnect);
  window.addEventListener('online', () => {
    hideConnectionBanner();
    attemptReconnect();
  });
  window.addEventListener('offline', updateConnectionStatus);
  showLoadingOverlay('Loading app…');
  await loadPlayers();
  await loadLiveChallenges();
  hideLoadingOverlay();
  // Restore active match view after a reload if present
  try {
    const stored = localStorage.getItem('xo_activeMatchId');
    if (stored) {
      setActiveMatchId(Number(stored));
      // Load and enter the stored match
      loadMatchById(Number(stored));
    } else {
      // start polling normally
    }
  } catch (e) { /* ignore */ }
});
