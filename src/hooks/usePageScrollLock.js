import { useEffect } from 'react'

let activeLocks = 0
let previousStyles = null

function lockPageScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const html = document.documentElement
  const body = document.body

  if (activeLocks === 0) {
    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth)
    const currentPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0

    previousStyles = {
      htmlOverflow: html.style.overflow,
      htmlOverscrollBehavior: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      bodyPaddingRight: body.style.paddingRight,
    }

    html.classList.add('page-scroll-locked')
    body.classList.add('page-scroll-locked')
    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`
    }
  }

  activeLocks += 1
}

function unlockPageScroll() {
  if (typeof document === 'undefined' || activeLocks === 0) return

  activeLocks -= 1
  if (activeLocks !== 0) return

  const html = document.documentElement
  const body = document.body

  html.classList.remove('page-scroll-locked')
  body.classList.remove('page-scroll-locked')

  if (previousStyles) {
    html.style.overflow = previousStyles.htmlOverflow
    html.style.overscrollBehavior = previousStyles.htmlOverscrollBehavior
    body.style.overflow = previousStyles.bodyOverflow
    body.style.overscrollBehavior = previousStyles.bodyOverscrollBehavior
    body.style.paddingRight = previousStyles.bodyPaddingRight
  }

  previousStyles = null
}

export default function usePageScrollLock(locked = true) {
  useEffect(() => {
    if (!locked) return undefined

    lockPageScroll()
    return unlockPageScroll
  }, [locked])
}
