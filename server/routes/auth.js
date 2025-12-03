const express = require('express')
const axios = require('axios')
const { createSession, destroySession } = require('../utils/session')

const router = express.Router()

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
const DISCORD_REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI || 'http://localhost:4000/auth/discord/callback'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'


router.get('/login', (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res
      .status(500)
      .send('Falta DISCORD_CLIENT_ID o DISCORD_CLIENT_SECRET en el archivo .env')
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    prompt: 'consent',
  })

  return res.redirect('https://discord.com/api/oauth2/authorize?' + params.toString())
})

router.get('/callback', async (req, res) => {
  const code = req.query.code
  const error = req.query.error

  if (error) {
    console.error('[OAuth] error query param from Discord:', error)
    return res
      .status(400)
      .send('Inicio de sesión cancelado o con error desde Discord: ' + error)
  }

  if (!code) {
    return res.status(400).send('Falta el parámetro "code" en el callback de Discord.')
  }

  try {
    const data = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    })

    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      validateStatus: () => true,
    })

    if (tokenRes.status !== 200) {
      console.error('[OAuth] error al pedir access_token:', tokenRes.status, tokenRes.data)
      return res
        .status(500)
        .send(
          'Error al obtener el token de Discord. Revisa que el CLIENT_ID, CLIENT_SECRET y REDIRECT_URI coincidan exactamente con los de la app en el Developer Portal.'
        )
    }

    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenRes.data.access_token}`,
      },
      validateStatus: () => true,
    })

    if (userRes.status !== 200) {
      console.error('[OAuth] error al pedir /users/@me:', userRes.status, userRes.data)
      return res
        .status(500)
        .send('Token recibido pero no se pudo obtener el usuario de Discord.')
    }

    createSession(res, userRes.data)
    return res.redirect(`${FRONTEND_URL}/#comments`)
  } catch (e) {
    console.error('[OAuth] excepción no controlada:', e.message)
    return res.status(500).send('Error inesperado en OAuth de Discord.')
  }
})

router.get('/logout', (req, res) => {
  destroySession(res)
  return res.redirect(`${FRONTEND_URL}/`)
})

module.exports = { router }
