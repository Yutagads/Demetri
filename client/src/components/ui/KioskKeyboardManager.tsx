import React, { useEffect, useRef, useState } from 'react'
import KioskKeyboard, { KioskEditable } from './KioskKeyboard'
import { useKioskMode } from '../../lib/kiosk'

const TEXT_INPUT_TYPES = new Set(['text', 'email', 'password', 'number', 'search', 'tel', 'url'])

function getEditable(target: EventTarget | null): KioskEditable | null {
  if (!(target instanceof HTMLElement)) return null

  const element = target.closest('input, textarea, [contenteditable="true"]')
  if (!element || !(element instanceof HTMLElement)) return null

  if (element instanceof HTMLInputElement) {
    const type = (element.type || 'text').toLowerCase()
    if (!TEXT_INPUT_TYPES.has(type) || element.disabled) return null
  }

  if (element instanceof HTMLTextAreaElement && element.disabled) return null
  return element as KioskEditable
}

function isInside(target: EventTarget | null, selector: string) {
  return target instanceof HTMLElement && Boolean(target.closest(selector))
}

export default function KioskKeyboardManager() {
  const kioskMode = useKioskMode()
  const [activeInput, setActiveInput] = useState<KioskEditable | null>(null)
  const activeInputRef = useRef<KioskEditable | null>(null)
  const pointerStart = useRef<{ x: number; y: number; touch: boolean } | null>(null)
  const scrolling = useRef(false)

  useEffect(() => {
    activeInputRef.current = activeInput
  }, [activeInput])

  useEffect(() => {
    if (!activeInput) return
    const timer = window.setTimeout(() => {
      if (document.body.contains(activeInput)) {
        activeInput.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }, 80)
    return () => window.clearTimeout(timer)
  }, [activeInput])

  useEffect(() => {
    if (!kioskMode) {
      setActiveInput(null)
      return
    }

    const syncEditableControls = () => {
      if (activeInputRef.current && !document.body.contains(activeInputRef.current)) {
        activeInputRef.current = null
        setActiveInput(null)
      }

      document.querySelectorAll('input, textarea, [contenteditable="true"]').forEach(node => {
        if (!(node instanceof HTMLElement)) return

        if (node instanceof HTMLInputElement) {
          const type = (node.type || 'text').toLowerCase()
          if (!TEXT_INPUT_TYPES.has(type) || node.disabled) return
          node.dataset.kioskManaged = 'true'
          node.readOnly = true
          node.inputMode = 'none'
        } else if (node instanceof HTMLTextAreaElement) {
          if (node.disabled) return
          node.dataset.kioskManaged = 'true'
          node.readOnly = true
          node.inputMode = 'none'
        } else {
          node.dataset.kioskManaged = 'true'
          node.setAttribute('inputmode', 'none')
        }
      })
    }

    syncEditableControls()
    const observer = new MutationObserver(syncEditableControls)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      document.querySelectorAll('[data-kiosk-managed="true"]').forEach(node => {
        if (!(node instanceof HTMLElement)) return
        if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
          node.readOnly = false
          node.removeAttribute('inputmode')
        } else {
          node.removeAttribute('inputmode')
        }
        delete node.dataset.kioskManaged
      })
    }
  }, [kioskMode])

  useEffect(() => {
    if (!kioskMode) return

    const handleFocus = (event: FocusEvent) => {
      const editable = getEditable(event.target)
      if (editable) {
        activeInputRef.current = editable
        setActiveInput(editable)
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      const touch = event.pointerType === 'touch' || event.pointerType === 'pen'
      pointerStart.current = { x: event.clientX, y: event.clientY, touch }
      scrolling.current = false

      if (!touch && !isInside(event.target, '[data-kiosk-keyboard], [data-kiosk-keep-keyboard]') && !getEditable(event.target)) {
        activeInputRef.current = null
        setActiveInput(null)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const start = pointerStart.current
      if (!start || !start.touch) return
      if (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8) {
        scrolling.current = true
      }
    }

    const handlePointerUp = (event: PointerEvent) => {
      const start = pointerStart.current
      pointerStart.current = null
      if (!start?.touch || scrolling.current) return

      const isEditable = getEditable(event.target)
      const shouldKeep = isEditable || isInside(event.target, '[data-kiosk-keyboard], [data-kiosk-keep-keyboard]')
      if (!shouldKeep) {
        activeInputRef.current = null
        setActiveInput(null)
      }
    }

    const handleScroll = () => {
      scrolling.current = true
    }

    document.addEventListener('focusin', handleFocus)
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointermove', handlePointerMove, true)
    document.addEventListener('pointerup', handlePointerUp, true)
    document.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointermove', handlePointerMove, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [kioskMode])

  if (!kioskMode || !activeInput) return null
  return <KioskKeyboard input={activeInput} onClose={() => setActiveInput(null)} />
}