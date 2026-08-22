import React, { useEffect, useState } from 'react'
import { ArrowUp, Delete, CornerDownLeft, ChevronDown, Sparkles } from 'lucide-react'

interface KioskKeyboardProps {
  input: KioskEditable | null
  onClose?: () => void
}

export type KioskEditable = HTMLInputElement | HTMLTextAreaElement | HTMLElement

type KeyboardMode = 'alpha' | 'symbols1' | 'symbols2'

// Alphabet layout
const numberRowAlpha = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const numberRowShifted = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')']

const letterRows = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

// Symbols layout 1 (?123)
const sym1Row0 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const sym1Row1 = ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"']
const sym1Row2 = ['.', ',', '?', '!', "'", '#', '%', '*', '+', '=']
const sym1Row3 = ['_', '\\', '|', '~', '<', '>', '[', ']']

// Symbols layout 2 (=\< / Alternative symbols)
const sym2Row0 = ['[', ']', '{', '}', '#', '%', '^', '*', '+', '=']
const sym2Row1 = ['_', '\\', '|', '~', '<', '>', '$', '€', '£', '¥']
const sym2Row2 = ['•', '°', '^', '÷', '×', '§', '©', '®', '™', '✓']
const sym2Row3 = [';', ':', '"', "'", '!', '?', '/', '\\']

export default function KioskKeyboard({ input, onClose }: KioskKeyboardProps) {
  const [shift, setShift] = useState(false)
  const [mode, setMode] = useState<KeyboardMode>('alpha')

  useEffect(() => {
    setShift(false)
    setMode('alpha')
  }, [input])

  const isTextControl = (element: KioskEditable): element is HTMLInputElement | HTMLTextAreaElement =>
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement

  const isContentEditable = (element: KioskEditable) =>
    element instanceof HTMLElement && element.isContentEditable

  const getValue = () => {
    if (!input) return ''
    if (isTextControl(input)) return input.value
    return input.textContent || ''
  }

  const getSelection = () => {
    if (!input) return { start: 0, end: 0 }
    if (isTextControl(input)) {
      return {
        start: input.selectionStart ?? input.value.length,
        end: input.selectionEnd ?? input.value.length,
      }
    }
    return { start: getValue().length, end: getValue().length }
  }

  const updateInput = (nextValue: string, caret: number) => {
    if (!input || !document.body.contains(input)) return

    if (isTextControl(input)) {
      const prototype = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
      setter?.call(input, nextValue)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.focus()
      input.setSelectionRange(caret, caret)
      return
    }

    if (isContentEditable(input)) {
      input.textContent = nextValue
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: nextValue,
      }))
      input.focus()
    }
  }

  const insertText = (text: string) => {
    if (!input) return
    const textToInsert = (shift && mode === 'alpha') ? text.toUpperCase() : text

    if (isContentEditable(input)) {
      document.execCommand('insertText', false, textToInsert)
      input.focus()
      if (shift) setShift(false)
      return
    }

    const { start, end } = getSelection()
    const value = getValue()
    updateInput(value.slice(0, start) + textToInsert + value.slice(end), start + textToInsert.length)
    if (shift) setShift(false)
  }

  const pressKey = (key: string) => {
    if (!input) return

    if (key === 'SHIFT') {
      setShift(value => !value)
      input.focus()
      return
    }

    if (key === 'MODE_SYMBOLS1') {
      setMode('symbols1')
      setShift(false)
      input.focus()
      return
    }

    if (key === 'MODE_SYMBOLS2') {
      setMode('symbols2')
      setShift(false)
      input.focus()
      return
    }

    if (key === 'MODE_ALPHA') {
      setMode('alpha')
      setShift(false)
      input.focus()
      return
    }

    if (key === 'BACKSPACE') {
      if (isContentEditable(input)) {
        document.execCommand('delete')
        input.focus()
        return
      }

      const { start, end } = getSelection()
      const value = getValue()
      if (start !== end) {
        updateInput(value.slice(0, start) + value.slice(end), start)
      } else if (start > 0) {
        updateInput(value.slice(0, start - 1) + value.slice(start), start - 1)
      }
      return
    }

    if (key === 'ENTER') {
      if (isTextControl(input) && input.tagName === 'INPUT') {
        input.form?.requestSubmit()
      } else {
        insertText('\n')
      }
      return
    }

    if (key === 'SPACE') {
      insertText(' ')
      return
    }

    insertText(key)
  }

  const keyButton = (key: string, label?: React.ReactNode, className = '', active = false) => (
    <button
      key={key}
      type="button"
      onPointerDown={event => {
        event.preventDefault()
        pressKey(key)
      }}
      className={`flex min-h-10 flex-1 items-center justify-center rounded-lg border font-medium shadow-sm transition-all duration-100 select-none active:scale-95 sm:min-h-11 sm:rounded-xl text-sm sm:text-base ${
        active
          ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-900/30'
          : 'border-white/10 bg-white/10 text-white hover:bg-white/20'
      } ${className}`}
      aria-label={typeof label === 'string' ? label : key}
    >
      {label ?? (shift && mode === 'alpha' ? key.toUpperCase() : key)}
    </button>
  )

  const inputPlaceholder = input && isTextControl(input) ? input.placeholder || input.name || 'Editing input' : 'Editing text'

  return (
    <div
      data-kiosk-keyboard="true"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/15 bg-slate-950/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_36px_rgba(0,0,0,0.5)] backdrop-blur-md sm:px-4 sm:pt-2"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-1.5 sm:gap-2">
        {/* Accessory Header */}
        <div className="flex items-center justify-between px-1 text-xs text-gray-400">
          <div className="flex items-center gap-1.5 truncate max-w-[70%]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="truncate font-mono text-[11px] text-gray-300">{inputPlaceholder}</span>
          </div>

          <div className="flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onPointerDown={e => {
                  e.preventDefault()
                  onClose()
                }}
                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                title="Hide keyboard"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Hide</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Mode: Alpha ── */}
        {mode === 'alpha' && (
          <>
            {/* Number Row (Standard or Shifted Symbols) */}
            <div className="flex gap-1 sm:gap-1.5">
              {(shift ? numberRowShifted : numberRowAlpha).map(key => keyButton(key))}
            </div>

            {/* QWERTY Row 1 */}
            <div className="flex gap-1 sm:gap-1.5">
              {letterRows[0].map(key => keyButton(key))}
            </div>

            {/* QWERTY Row 2 */}
            <div className="flex gap-1 sm:gap-1.5 px-2 sm:px-3">
              {letterRows[1].map(key => keyButton(key))}
            </div>

            {/* QWERTY Row 3 (Shift, Letters, Backspace) */}
            <div className="flex gap-1 sm:gap-1.5">
              {keyButton(
                'SHIFT',
                <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />,
                'flex-[1.5] max-w-20',
                shift
              )}
              {letterRows[2].map(key => keyButton(key))}
              {keyButton(
                'BACKSPACE',
                <Delete className="h-4 w-4 sm:h-5 sm:w-5" />,
                'flex-[1.5] max-w-20 bg-white/15'
              )}
            </div>

            {/* Bottom Row: ?123, @, -, Space, ., ,, Enter */}
            <div className="flex gap-1 sm:gap-1.5">
              {keyButton('MODE_SYMBOLS1', '?123', 'flex-[1.5] max-w-20 bg-white/15 font-semibold text-emerald-300')}
              {keyButton('@', '@', 'flex-1 max-w-14')}
              {keyButton('-', '-', 'flex-1 max-w-14')}
              {keyButton('SPACE', 'Space', 'flex-[4] font-medium')}
              {keyButton('.', '.', 'flex-1 max-w-14')}
              {keyButton(',', ',', 'flex-1 max-w-14')}
              {keyButton(
                'ENTER',
                <CornerDownLeft className="h-4 w-4 sm:h-5 sm:w-5" />,
                'flex-[1.5] max-w-20 bg-emerald-600 border-emerald-500 text-white font-semibold shadow-md hover:bg-emerald-500'
              )}
            </div>
          </>
        )}

        {/* ── Mode: Symbols 1 (?123) ── */}
        {mode === 'symbols1' && (
          <>
            {/* Number Row */}
            <div className="flex gap-1 sm:gap-1.5">
              {sym1Row0.map(key => keyButton(key))}
            </div>

            {/* Symbols Row 1 */}
            <div className="flex gap-1 sm:gap-1.5">
              {sym1Row1.map(key => keyButton(key))}
            </div>

            {/* Symbols Row 2 */}
            <div className="flex gap-1 sm:gap-1.5">
              {sym1Row2.map(key => keyButton(key))}
            </div>

            {/* Symbols Row 3 (=\< toggle, Alt keys, Backspace) */}
            <div className="flex gap-1 sm:gap-1.5">
              {keyButton(
                'MODE_SYMBOLS2',
                '=\\<',
                'flex-[1.5] max-w-20 bg-white/15 font-semibold text-amber-300'
              )}
              {sym1Row3.map(key => keyButton(key))}
              {keyButton(
                'BACKSPACE',
                <Delete className="h-4 w-4 sm:h-5 sm:w-5" />,
                'flex-[1.5] max-w-20 bg-white/15'
              )}
            </div>

            {/* Bottom Row */}
            <div className="flex gap-1 sm:gap-1.5">
              {keyButton('MODE_ALPHA', 'ABC', 'flex-[1.5] max-w-20 bg-white/15 font-semibold text-sky-300')}
              {keyButton('@', '@', 'flex-1 max-w-14')}
              {keyButton('-', '-', 'flex-1 max-w-14')}
              {keyButton('SPACE', 'Space', 'flex-[4] font-medium')}
              {keyButton('.', '.', 'flex-1 max-w-14')}
              {keyButton(',', ',', 'flex-1 max-w-14')}
              {keyButton(
                'ENTER',
                <CornerDownLeft className="h-4 w-4 sm:h-5 sm:w-5" />,
                'flex-[1.5] max-w-20 bg-emerald-600 border-emerald-500 text-white font-semibold shadow-md hover:bg-emerald-500'
              )}
            </div>
          </>
        )}

        {/* ── Mode: Symbols 2 (=\< Extended Math & Special Symbols) ── */}
        {mode === 'symbols2' && (
          <>
            {/* Extended Row 0 */}
            <div className="flex gap-1 sm:gap-1.5">
              {sym2Row0.map(key => keyButton(key))}
            </div>

            {/* Extended Row 1 */}
            <div className="flex gap-1 sm:gap-1.5">
              {sym2Row1.map(key => keyButton(key))}
            </div>

            {/* Extended Row 2 */}
            <div className="flex gap-1 sm:gap-1.5">
              {sym2Row2.map(key => keyButton(key))}
            </div>

            {/* Extended Row 3 (?123 toggle, Alt keys, Backspace) */}
            <div className="flex gap-1 sm:gap-1.5">
              {keyButton(
                'MODE_SYMBOLS1',
                '?123',
                'flex-[1.5] max-w-20 bg-white/15 font-semibold text-emerald-300'
              )}
              {sym2Row3.map(key => keyButton(key))}
              {keyButton(
                'BACKSPACE',
                <Delete className="h-4 w-4 sm:h-5 sm:w-5" />,
                'flex-[1.5] max-w-20 bg-white/15'
              )}
            </div>

            {/* Bottom Row */}
            <div className="flex gap-1 sm:gap-1.5">
              {keyButton('MODE_ALPHA', 'ABC', 'flex-[1.5] max-w-20 bg-white/15 font-semibold text-sky-300')}
              {keyButton('@', '@', 'flex-1 max-w-14')}
              {keyButton('_', '_', 'flex-1 max-w-14')}
              {keyButton('SPACE', 'Space', 'flex-[4] font-medium')}
              {keyButton('.', '.', 'flex-1 max-w-14')}
              {keyButton(',', ',', 'flex-1 max-w-14')}
              {keyButton(
                'ENTER',
                <CornerDownLeft className="h-4 w-4 sm:h-5 sm:w-5" />,
                'flex-[1.5] max-w-20 bg-emerald-600 border-emerald-500 text-white font-semibold shadow-md hover:bg-emerald-500'
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
