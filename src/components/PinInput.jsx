import { useEffect, useRef } from 'react'

export default function PinInput({
  value = '',
  onChange,
  length = 4,
  disabled = false,
  autoFocus = false,
  idPrefix = 'pin',
}) {
  const digits = Array.from({ length }, (_, i) => value[i] || '')
  const refs = useRef([])

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus()
  }, [autoFocus])

  function setDigit(index, raw) {
    const digit = String(raw).replace(/\D/g, '').slice(-1)
    const next = digits.map((d, i) => (i === index ? digit : d))
    onChange(next.join(''))
    if (digit && index < length - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  function onKeyDown(index, event) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (digits[index]) {
        const next = digits.map((d, i) => (i === index ? '' : d))
        onChange(next.join(''))
      } else if (index > 0) {
        const next = digits.map((d, i) => (i === index - 1 ? '' : d))
        onChange(next.join(''))
        refs.current[index - 1]?.focus()
      }
      return
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  function onPaste(event) {
    event.preventDefault()
    const pasted = (event.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    onChange(pasted)
    const focusAt = Math.min(pasted.length, length - 1)
    refs.current[focusAt]?.focus()
  }

  return (
    <div className="flex items-center justify-center gap-3" onPaste={onPaste}>
      {digits.map((digit, index) => (
        <input
          key={`${idPrefix}-${index}`}
          ref={(el) => {
            refs.current[index] = el
          }}
          id={`${idPrefix}-${index}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`PIN digit ${index + 1}`}
          className="h-14 w-12 rounded-xl border border-[var(--border)] bg-white text-center text-2xl font-semibold tracking-widest outline-none transition focus:border-hospital focus:ring-2 focus:ring-hospital/20 disabled:opacity-60"
          onChange={(e) => setDigit(index, e.target.value)}
          onKeyDown={(e) => onKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  )
}
