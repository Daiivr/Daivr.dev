const jwt = require('jsonwebtoken')

const COOKIE_NAME = 'discord_session'

// ---- Admin IDs desde .env ----
// Soporta varios nombres para que funcione en local y en Render sin tener que
// recordar exactamente cuál usaste.
//
// Recomendado:
//   ADMIN_IDS=ID1,ID2,ID3
//
// También soporta (single o comma-separated):
//   ADMIN_ID, ADMIN_DISCORD_ID, ADMIN_DISCORD_IDS,
//   VITE_ADMIN_ID, VITE_ADMIN_IDS, VITE_ADMIN_DISCORD_ID, VITE_ADMIN_DISCORD_IDS
const ADMIN_ENV_KEYS = [
  'ADMIN_IDS',
  'ADMIN_ID',
  'ADMIN_DISCORD_ID',
  'ADMIN_DISCORD_IDS',
  'VITE_ADMIN_ID',
  'VITE_ADMIN_IDS',
  'VITE_ADMIN_DISCORD_ID',
  'VITE_ADMIN_DISCORD_IDS',
]

function splitIds(raw) {
  if (!raw) return []
  return String(raw)
    .split(/[,\s]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
}

function getAdminIdSet() {
  const ids = []
  for (const k of ADMIN_ENV_KEYS) {
    ids.push(...splitIds(process.env[k]))
  }
  return new Set(ids.map((x) => String(x)))
}

function getCookieOptions() {
  // Defaults seguros para la mayoría de setups:
  // - local: http => secure false
  // - prod (Render): https => secure true (normalmente)
  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production' || !!process.env.RENDER

  const envSameSite = process.env.COOKIE_SAMESITE
  const envSecure = process.env.COOKIE_SECURE

  let sameSite = (envSameSite || 'lax').toLowerCase()
  let secure = envSecure != null ? String(envSecure).toLowerCase() === 'true' : isProd

  // Si sameSite=None, el navegador requiere Secure=true
  if (sameSite === 'none') secure = true

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }
}

function createSession(res, discordUser) {
  // Usar el nombre visible de Discord (display name) si existe; si no, caer al username clásico
  const displayName =
    discordUser.global_name ||
    (discordUser.username && discordUser.discriminator
      ? `${discordUser.username}#${discordUser.discriminator}`
      : discordUser.username)

  const token = jwt.sign(
    {
      id: discordUser.id,
      username: displayName,
      avatar: discordUser.avatar,
    },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  )

  res.cookie(COOKIE_NAME, token, getCookieOptions())
}

function destroySession(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' })
}

function getUserFromRequest(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME]
  if (!token) return null

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    const avatarUrl = payload.avatar
      ? `https://cdn.discordapp.com/avatars/${payload.id}/${payload.avatar}.png?size=64`
      : `https://cdn.discordapp.com/embed/avatars/0.png`

    const adminSet = getAdminIdSet()
    const isAdmin = adminSet.has(String(payload.id))

    return {
      id: payload.id,
      username: payload.username,
      avatarUrl,
      isAdmin,
    }
  } catch (e) {
    return null
  }
}

module.exports = { createSession, destroySession, getUserFromRequest }
