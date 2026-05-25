import { createPortal } from 'react-dom'
import usePageScrollLock from '../hooks/usePageScrollLock'

export default function ModalPortal({ children }) {
  usePageScrollLock()

  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
