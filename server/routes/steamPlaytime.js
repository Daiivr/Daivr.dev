const express = require('express')
const axios = require('axios')

const router = express.Router()

const STEAM_API_KEY = process.env.STEAM_API_KEY || null
const STEAM_ID64 = process.env.STEAM_ID64 || process.env.STEAM_USER_ID || null
const CACHE_MS = Number(process.env.STEAM_PLAYTIME_CACHE_MS) || 10 * 60 * 1000

const TRACKED_GAMES = [
  { key: 'nier-automata', appId: 524220 },
  { key: 'fallout-76', appId: 1151340 },
  { key: 'rdr2', appId: 1174180 },
]

let cache = {
  expiresAt: 0,
  payload: null,
}

function emptyGames(reason = 'unavailable') {
  return TRACKED_GAMES.reduce((acc, game) => {
    acc[String(game.appId)] = {
      appId: game.appId,
      key: game.key,
      available: false,
      playtimeMinutes: null,
      playtimeHours: null,
      reason,
    }
    return acc
  }, {})
}

function buildPayload(ownedGames) {
  const ownedByAppId = new Map(
    (Array.isArray(ownedGames) ? ownedGames : []).map((game) => [
      Number(game.appid),
      game,
    ]),
  )

  const games = TRACKED_GAMES.reduce((acc, tracked) => {
    const owned = ownedByAppId.get(tracked.appId)
    const minutes = Number(owned?.playtime_forever)
    const hasMinutes = Number.isFinite(minutes)

    acc[String(tracked.appId)] = {
      appId: tracked.appId,
      key: tracked.key,
      available: hasMinutes,
      playtimeMinutes: hasMinutes ? minutes : null,
      playtimeHours: hasMinutes ? Math.round((minutes / 60) * 10) / 10 : null,
      reason: hasMinutes ? null : 'private-or-not-owned',
    }
    return acc
  }, {})

  return {
    configured: true,
    games,
    updatedAt: new Date().toISOString(),
  }
}

router.get('/', async (req, res) => {
  if (!STEAM_API_KEY || !STEAM_ID64) {
    return res.json({
      configured: false,
      games: emptyGames('not-configured'),
      updatedAt: new Date().toISOString(),
    })
  }

  const now = Date.now()
  if (cache.payload && cache.expiresAt > now) {
    return res.json(cache.payload)
  }

  try {
    const steamRes = await axios.get(
      'https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/',
      {
        params: {
          key: STEAM_API_KEY,
          steamid: STEAM_ID64,
          include_appinfo: false,
          include_played_free_games: true,
          format: 'json',
        },
        timeout: 8000,
      },
    )

    const ownedGames = steamRes.data?.response?.games
    const payload = buildPayload(ownedGames)
    cache = {
      expiresAt: now + CACHE_MS,
      payload,
    }
    return res.json(payload)
  } catch (err) {
    console.error('Steam playtime error:', err.response?.status || err.message || err)
    return res.status(502).json({
      configured: true,
      error: 'steam-unavailable',
      games: emptyGames('steam-unavailable'),
      updatedAt: new Date().toISOString(),
    })
  }
})

module.exports = { router }
