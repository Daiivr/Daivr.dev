const express = require('express')
const fs = require('fs')
const path = require('path')
const { getUserFromRequest } = require('../utils/session')

const router = express.Router()

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const FILE = path.join(DATA_DIR, 'links.json')

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify([], null, 2), 'utf8')

function readLinks() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function writeLinks(links) {
  fs.writeFileSync(FILE, JSON.stringify(links, null, 2), 'utf8')
}

// GET all links
router.get('/', (req, res) => {
  const links = readLinks()
  res.json({ links })
})

// POST create new link (requires Discord login)
router.post('/', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const { label, href, iconUrl } = req.body || {}

  if (!label || !href) {
    return res.status(400).json({ error: 'Faltan campos requeridos' })
  }

  const links = readLinks()
  const link = {
    id: Date.now(),
    label: String(label).slice(0, 80),
    href: String(href).slice(0, 300),
    iconUrl: iconUrl ? String(iconUrl).slice(0, 500) : '',
  }

  links.push(link)
  writeLinks(links)

  res.json({ link })
})

// PUT update existing link
router.put('/:id', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const { label, href, iconUrl } = req.body || {}
  if (!label || !href) {
    return res.status(400).json({ error: 'Faltan campos requeridos' })
  }

  const id = Number(req.params.id)
  const links = readLinks()
  const index = links.findIndex((l) => l.id === id)

  if (index === -1) {
    return res.status(404).json({ error: 'Link no encontrado' })
  }

  links[index].label = String(label).slice(0, 80)
  links[index].href = String(href).slice(0, 300)
  links[index].iconUrl = iconUrl ? String(iconUrl).slice(0, 500) : ''

  writeLinks(links)

  res.json({ link: links[index] })
})

// DELETE link
router.delete('/:id', (req, res) => {
  const user = getUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Debes iniciar sesión con Discord' })

  const id = Number(req.params.id)
  const links = readLinks()
  const before = links.length
  const filtered = links.filter((l) => l.id !== id)

  writeLinks(filtered)

  const removed = before !== filtered.length
  res.json({ success: removed })
})

module.exports = { router }
