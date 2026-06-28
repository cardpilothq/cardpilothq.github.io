function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const PLAYER_POSITIONS = new Map([
  ['james conner', 'RB'],
  ['kyler murray', 'QB'],
  ['trey mcbride', 'TE'],
  ['marvin harrison', 'WR'],
  ['michael wilson', 'WR'],
  ['greg dortch', 'WR'],
  ['zach ertz', 'TE'],
  ['rondale moore', 'WR'],
  ['hollywood brown', 'WR'],
  ['drake london', 'WR'],
  ['kyle pitts', 'TE'],
  ['bijan robinson', 'RB'],
  ['desmond ridder', 'QB'],
  ['kirk cousins', 'QB'],
  ['patrick mahomes', 'QB'],
  ['josh allen', 'QB'],
  ['lamar jackson', 'QB'],
  ['justin herbert', 'QB'],
  ['joe burrow', 'QB'],
  ['dak prescott', 'QB'],
  ['trevor lawrence', 'QB'],
  ['cj stroud', 'QB'],
  ['bryce young', 'QB'],
  ['davante adams', 'WR'],
  ['stefon diggs', 'WR'],
  ['tyreek hill', 'WR'],
  ['ceedee lamb', 'WR'],
  ['travis kelce', 'TE'],
  ['christian mccaffrey', 'RB'],
  ['saquon barkley', 'RB'],
  ['derrick henry', 'RB']
])

export function lookupPositionFromPlayer(playerName) {
  const normalized = normalizeName(playerName)
  if (!normalized) return null

  const exact = PLAYER_POSITIONS.get(normalized)
  if (exact) return exact

  // Fallback for occasional OCR punctuation/noise around names.
  for (const [knownName, position] of PLAYER_POSITIONS.entries()) {
    if (normalized.includes(knownName) || knownName.includes(normalized)) {
      return position
    }
  }

  return null
}
