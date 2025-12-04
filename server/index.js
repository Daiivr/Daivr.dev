require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const path = require('path')
const axios = require('axios')

const { router: authRouter } = require('./routes/auth')
const { router: commentsRouter } = require('./routes/comments')
const { router: galleryRouter } = require('./routes/gallery')
const { router: linksRouter } = require('./routes/links')
const { getUserFromRequest } = require('./utils/session')

const app = express()
const PORT = process.env.PORT || 4000


const UPLOAD_DIR =
  process.env.GALLERY_UPLOAD_DIR ||
  path.join(__dirname, '..', 'uploads')

const STEAMGRID_API_KEY = process.env.STEAMGRID_API_KEY || null
const steamGridCache = new Map()

async function getGameImageFromSteamGrid(gameName) {
  if (!STEAMGRID_API_KEY) return null
  if (!gameName) return null

  const key = gameName.toLowerCase()

  if (steamGridCache.has(key)) {
    return steamGridCache.get(key)
  }

  try {
    const searchRes = await axios.get(
      `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(gameName)}`,
      {
        headers: {
          Authorization: `Bearer ${STEAMGRID_API_KEY}`,
        },
      }
    )

    const games = searchRes.data && searchRes.data.data
    if (!games || !games.length) {
      steamGridCache.set(key, null)
      return null
    }

    const gameId = games[0].id

    const heroRes = await axios.get(
      `https://www.steamgriddb.com/api/v2/icons/game/${gameId}`,
      {
        headers: {
          Authorization: `Bearer ${STEAMGRID_API_KEY}`,
        },
      }
    )

    const heroes = heroRes.data && heroRes.data.data
    const url = heroes && heroes.length ? heroes[0].url : null

    steamGridCache.set(key, url || null)
    return url || null
  } catch (err) {
    console.error('SteamGridDB error', err.message || err)
    steamGridCache.set(key, null)
    return null
  }
}


app.use(
  cors({
    origin: true,
    credentials: true,
  })
)

app.use(express.json())
app.use(cookieParser())
app.use('/uploads', express.static(UPLOAD_DIR))

app.use('/auth/discord', authRouter)
app.use('/api/comments', commentsRouter)
app.use('/api/gallery', galleryRouter)
app.use('/api/links', linksRouter)


app.get('/api/game-image', async (req, res) => {
  const name = req.query.name
  if (!name) {
    return res.status(400).json({ error: 'Missing name parameter' })
  }

  try {
    const url = await getGameImageFromSteamGrid(name)
    res.json({ url })
  } catch (error) {
    console.error('Error in /api/game-image', error.message || error)
    res.status(500).json({ error: 'Failed to fetch game image' })
  }
})



app.get('/api/me', (req, res) => {
  const user = getUserFromRequest(req)
  res.json({ user })
})


// Serve Vite build in production
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

// Fallback for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log('API server running on http://localhost:' + PORT)
})