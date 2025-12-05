const jwt = require('jsonwebtoken')

const COOKIE_NAME = 'discord_session'

// IDs de admins leídos desde .env: ADMIN_IDS=id1,id2
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

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
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

function destroySession(res) {
  res.clearCookie(COOKIE_NAME)
}

function getUserFromRequest(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME]
  if (!token) return null

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    const avatarUrl = payload.avatar
      ? `https://cdn.discordapp.com/avatars/${payload.id}/${payload.avatar}.png?size=64`
      : `https://cdn.discordapp.com/embed/avatars/0.png`

    const isAdmin = ADMIN_IDS.includes(String(payload.id))

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
