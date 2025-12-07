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
const { router: visitsRouter } = require('./routes/visits')
const { getUserFromRequest } = require('./utils/session')

const app = express()
const PORT = process.env.PORT || 4000


const UPLOAD_DIR =
  process.env.GALLERY_UPLOAD_DIR ||
  path.join(__dirname, '..', 'uploads')

const STEAMGRID_API_KEY = process.env.STEAMGRID_API_KEY || null
const steamGridCache = new Map()



const TENOR_API_KEY = process.env.VITE_TENOR_API_KEY || process.env.TENOR_API_KEY || null
const TENOR_CLIENT_KEY = 'daivr-dev-comments'
const TENOR_LIMIT = 48

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
app.use('/api/visits', visitsRouter)


app.get('/api/tenor-search', async (req, res) => {
  try {
    if (!TENOR_API_KEY) {
      return res.status(500).json({
        error: 'missing-tenor-key',
        message: 'Falta configurar VITE_TENOR_API_KEY o TENOR_API_KEY en el servidor.',
      })
    }

    const q = (req.query.q || '').toString().trim()
    if (!q) {
      return res.status(400).json({ error: 'missing-query', message: 'Falta el parámetro q' })
    }

    // Intento 1: API nueva v2 (Google)
    try {
      const resV2 = await axios.get('https://tenor.googleapis.com/v2/search', {
        params: {
          key: TENOR_API_KEY,
          client_key: TENOR_CLIENT_KEY,
          q,
          limit: TENOR_LIMIT,
          media_filter: 'tinygif,mediumgif',
          contentfilter: 'high',
        },
      })

      const results = resV2.data?.results || []
      const gifs = results
        .map((item) => {
          const media =
            item.media_formats?.tinygif ||
            item.media_formats?.mediumgif ||
            item.media_formats?.gif
          return media?.url
        })
        .filter(Boolean)

      if (gifs.length > 0) {
        return res.json({ gifs, source: 'v2' })
      }
    } catch (errV2) {
      console.error('Tenor v2 error:', errV2.response?.status || errV2.message || errV2)
      // fallback a v1
    }

    // Intento 2: API clásica v1
    const resV1 = await axios.get('https://g.tenor.com/v1/search', {
      params: {
        key: TENOR_API_KEY,
        q,
        limit: TENOR_LIMIT,
        media_filter: 'minimal',
        contentfilter: 'high',
      },
    })

    const resultsV1 = resV1.data?.results || []
    const gifsV1 = resultsV1
      .map((item) => {
        const media = Array.isArray(item.media) ? item.media[0] : null
        return (
          media?.tinygif?.url ||
          media?.mediumgif?.url ||
          media?.gif?.url
        )
      })
      .filter(Boolean)

    if (gifsV1.length === 0) {
      return res.json({ gifs: [], source: 'v1' })
    }

    return res.json({ gifs: gifsV1, source: 'v1' })
  } catch (error) {
    console.error('Tenor final error:', error.response?.status || error.message || error)
    return res.status(500).json({
      error: 'tenor-error',
      message: 'No se pudieron cargar los GIFs desde Tenor.',
    })
  }
})


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