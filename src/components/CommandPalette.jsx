import React, { useEffect, useMemo, useRef, useState } from 'react'
import ModalPortal from './ModalPortal'

const normalizeQuery = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const isTypingTarget = (target) => {
  if (!target || typeof target.closest !== 'function') return false
  return Boolean(
    target.closest('input, textarea, select, button, [contenteditable="true"]'),
  )
}

export default function CommandPalette({
  enabled = true,
  commands = [],
  secretCommands = [],
  onSecretCommand,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)

  const normalizedQuery = normalizeQuery(query)

  const mergedSecretCommands = useMemo(() => {
    const fallback = onSecretCommand
      ? [
          {
            id: 'secret-terminal-vibe',
            label: 'sudo vibe',
            detail: 'run hidden terminal routine',
            category: 'secret',
            icon: '!!',
            aliases: ['vibe'],
            action: onSecretCommand,
          },
        ]
      : []

    return [...fallback, ...secretCommands].map((command) => ({
      ...command,
      secret: true,
      category: command.category || 'secret',
    }))
  }, [onSecretCommand, secretCommands])

  const visibleCommands = useMemo(() => {
    const baseCommands = commands.filter((command) => !command.hidden)

    if (!normalizedQuery) return baseCommands.slice(0, 8)

    const matches = baseCommands.filter((command) => {
      const haystack = [
        command.label,
        command.detail,
        command.category,
        ...(command.keywords || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })

    const secretMatches = mergedSecretCommands.filter((command) => {
      const terms = [
        command.label,
        command.detail,
        command.category,
        ...(command.aliases || []),
        ...(command.keywords || []),
      ]
        .filter(Boolean)
        .map(normalizeQuery)

      return terms.some(
        (term) =>
          term === normalizedQuery ||
          term.startsWith(normalizedQuery) ||
          term.includes(normalizedQuery),
      )
    })

    return [...secretMatches, ...matches].slice(0, 9)
  }, [commands, mergedSecretCommands, normalizedQuery])

  useEffect(() => {
    if (activeIndex >= visibleCommands.length) {
      setActiveIndex(0)
    }
  }, [activeIndex, visibleCommands.length])

  useEffect(() => {
    if (!enabled) {
      setOpen(false)
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return

      const key = event.key || ''
      const isPaletteShortcut =
        (event.ctrlKey || event.metaKey) && key.toLowerCase() === 'k'
      const isSlashShortcut = key === '/' && !isTypingTarget(event.target)

      if (isPaletteShortcut || isSlashShortcut) {
        event.preventDefault()
        setQuery('')
        setActiveIndex(0)
        setOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])

  useEffect(() => {
    if (!open) return undefined

    const focusFrame = requestAnimationFrame(() => {
      inputRef.current?.focus()
    })

    return () => cancelAnimationFrame(focusFrame)
  }, [open])

  const closePalette = () => {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  const runCommand = (command) => {
    if (!command) return

    command.action?.()
    closePalette()
  }

  const handlePaletteKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closePalette()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) =>
        visibleCommands.length ? (prev + 1) % visibleCommands.length : 0,
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) =>
        visibleCommands.length
          ? (prev - 1 + visibleCommands.length) % visibleCommands.length
          : 0,
      )
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      runCommand(visibleCommands[activeIndex])
    }
  }

  if (!enabled || !open) return null

  return (
    <ModalPortal>
      <div
        className="command-palette-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePalette()
        }}
      >
        <div
          className="command-palette-card"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          onKeyDown={handlePaletteKeyDown}
        >
          <div className="command-palette-topline">
            <span>command.palette</span>
            <span>ctrl+k / slash</span>
          </div>

          <label className="command-palette-input-shell">
            <span className="command-palette-prompt" aria-hidden="true">
              &gt;
            </span>
            <input
              ref={inputRef}
              className="command-palette-input"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              placeholder="Search routes, audio, commands..."
              spellCheck="false"
            />
          </label>

          <div className="command-palette-list" role="listbox">
            {visibleCommands.length > 0 ? (
              visibleCommands.map((command, index) => (
                <button
                  key={command.id}
                  type="button"
                  className={`command-palette-item ${
                    index === activeIndex ? 'is-active' : ''
                  } ${command.secret ? 'is-secret' : ''}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runCommand(command)}
                >
                  <span className="command-palette-icon" aria-hidden="true">
                    {command.icon || '::'}
                  </span>
                  <span className="command-palette-copy">
                    <span>{command.label}</span>
                    <small>{command.detail}</small>
                  </span>
                  <span className="command-palette-category">
                    {command.category}
                  </span>
                </button>
              ))
            ) : (
              <div className="command-palette-empty">
                <span>no command found</span>
                <small>try route names, audio actions, or a terminal phrase</small>
              </div>
            )}
          </div>

          <div className="command-palette-footer" aria-hidden="true">
            <span>enter run</span>
            <span>esc close</span>
            <span>arrows select</span>
            <span>try sudo</span>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
