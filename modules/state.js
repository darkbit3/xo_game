export const ME = {
  id: 0,
  username: '@player',
  initials: 'P',
  colorClass: 'me',
  status: 'online',
}

export const appState = {
  currentUserProfile: null,
  onlinePlayers: [],
  liveChallenges: [],
  liveMatches: [],
  pendingInvite: null,
  livePollingTimer: null,
  activeMatchId: null,
  liveStream: null,
  rematchOpponentName: null,
  rematchInProgress: false,
  matchViewOpen: false,
  betAmount: 0,
  selectedPlayer: null,
}

export const gameState = {
  board: Array(9).fill(null),
  currentPlayer: 'X',
  running: false,
  vsAI: false,
  scores: { X: 0, O: 0 },
  moveInProgress: false,
  stats: { wins: 0, draws: 0, losses: 0 },
  reset() {
    this.board = Array(9).fill(null)
    this.currentPlayer = 'X'
    this.running = true
    this.moveInProgress = false
  },
}
